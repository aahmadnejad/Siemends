import os
import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import FastAPI, Depends, HTTPException, status, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from typing import Optional, Literal
from fastapi.security import OAuth2PasswordBearer

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_NAME = os.getenv("DB_NAME", "siem_db")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASS = os.getenv("DB_PASS", "pass123")

SECRET_KEY = "Siemend2026aahmadnejad"
ALGORITHM = "HS256"
INITIAL_EXPIRE_MINUTES = 15
EXTEND_EXPIRE_MINUTES = 10

db_config = {
    "host": DB_HOST,
    "database": DB_NAME,
    "user": DB_USER,
    "password": DB_PASS
}

app = FastAPI(title="SIEMENDS API")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Refresh-Token"]
)

# MODELS
class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    role: str 

class LoginRequest(BaseModel):
    username: str
    password: str

class ProfileUpdate(BaseModel):
    new_username: Optional[str] = None
    new_password: Optional[str] = None

class StatusUpdate(BaseModel):
    new_status: str

class CommentCreate(BaseModel):
    comment_text: str

class AlertFilter(BaseModel):
    page: int = 1
    size: int = 50
    status: Optional[str] = None
    severity: Optional[str] = None
    assigned_to: Optional[int] = None 
    mine_only: bool = False             
    search_query: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    sort_by: str = "time"
    order: Literal["ASC", "DESC"] = "DESC"

class EvidenceFilter(BaseModel):
    window_minutes: int = 5
    page: int = 1
    size: int = 200

class AssignUpdate(BaseModel):
    user_id: int



def create_access_token(data: dict, expires_delta: timedelta):
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_db():
    conn = psycopg2.connect(**db_config, cursor_factory=RealDictCursor)
    try:
        yield conn
    finally:
        conn.close()

def secure_auth_verify(response: Response, token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_info = {"id": payload.get("id"), "sub": payload.get("sub"), "role": payload.get("role")}
        if user_info["sub"] is None:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        new_token = create_access_token(
            data={"sub": user_info["sub"], "id": user_info["id"], "role": user_info["role"]},
            expires_delta=timedelta(minutes=EXTEND_EXPIRE_MINUTES)
        )
        response.headers["X-Refresh-Token"] = new_token
        return user_info
    except JWTError:
        raise HTTPException(status_code=401, detail="Session expired")


# ENDPOINTS


@app.post("/api/auth/login")
def login(request: LoginRequest, db=Depends(get_db)):
    cur = db.cursor()
    cur.execute("SELECT * FROM users WHERE username = %s", (request.username,))
    user = cur.fetchone()
    if not user or not pwd_context.verify(request.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid Credentials")
    cur.execute("UPDATE users SET last_login = NOW() WHERE id = %s", (user['id'],))
    db.commit()
    token = create_access_token(
        data={"sub": user["username"], "id": user["id"], "role": user["role"]},
        expires_delta=timedelta(minutes=INITIAL_EXPIRE_MINUTES)
    )
    return {"access_token": token, "role": user["role"]}

@app.post("/api/admin/users")
def add_user(new_user: UserCreate, db=Depends(get_db), auth=Depends(secure_auth_verify)):
    if auth["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")
    cur = db.cursor()
    hashed_password = pwd_context.hash(new_user.password)
    cur.execute(
        "INSERT INTO users (username, password_hash, full_name, role) VALUES (%s, %s, %s, %s)",
        (new_user.username, hashed_password, new_user.full_name, new_user.role)
    )
    db.commit()
    return {"message": "User added successfully"}

@app.post("/api/alerts")
def get_alerts(filters: AlertFilter, db=Depends(get_db), auth=Depends(secure_auth_verify)):
    cur = db.cursor()
    common_where = " WHERE 1=1"
    common_params = []
    if filters.mine_only:
        common_where += " AND assigned_to = %s"
        common_params.append(auth["id"])
    elif filters.assigned_to is not None:
        if filters.assigned_to == 0:
            common_where += " AND assigned_to IS NULL"
        else:
            common_where += " AND assigned_to = %s"
            common_params.append(filters.assigned_to)

    if filters.status:
        common_where += " AND status = %s"
        common_params.append(filters.status.upper())

    if filters.search_query:
        common_where += " AND (alert_type ILIKE %s OR ai_analysis::text ILIKE %s OR details::text ILIKE %s OR source_ip::text ILIKE %s OR victim_ip::text ILIKE %s)"
        pattern = f"%{filters.search_query}%"
        common_params.extend([pattern, pattern, pattern, pattern, pattern]) 

    if filters.start_time:
        common_where += " AND time >= %s"
        common_params.append(filters.start_time)
        if filters.end_time:
            common_where += " AND time <= %s"
            common_params.append(filters.end_time)
        else:
            common_where += " AND time <= NOW()"

    stats_query = f"SELECT severity, COUNT(*) as count FROM detected_alerts {common_where} GROUP BY severity"
    cur.execute(stats_query, common_params)
    stats_rows = cur.fetchall()
    stats = { row['severity']: row['count'] for row in stats_rows }
    
    cur.execute(f"SELECT COUNT(*) as count FROM detected_alerts {common_where}", common_params)
    stats['TOTAL'] = cur.fetchone()['count']

    final_where = common_where
    final_params = list(common_params)
    if filters.severity:
        final_where += " AND severity = %s"
        final_params.append(filters.severity.upper())

    cur.execute(f"SELECT COUNT(*) as count FROM detected_alerts {final_where}", final_params)
    total_count = cur.fetchone()['count']

    allowed_sorts = {"time", "severity", "status"}
    sort_col = filters.sort_by if filters.sort_by in allowed_sorts else "time"
    sort_dir = "ASC" if filters.order == "ASC" else "DESC"
    offset = (filters.page - 1) * filters.size
    final_query = f"SELECT * FROM detected_alerts {final_where} ORDER BY {sort_col} {sort_dir} LIMIT %s OFFSET %s"
    cur.execute(final_query, final_params + [filters.size, offset])
    alerts = cur.fetchall()

    return {"alerts": alerts, "page": filters.page, "size": filters.size, "total_count": total_count, "has_more": (filters.page * filters.size) < total_count, "stats": stats}

@app.get("/api/users/list")
def get_assignable_users(db=Depends(get_db), auth=Depends(secure_auth_verify)):
    cur = db.cursor()
    cur.execute("SELECT id, username, full_name, role FROM users ORDER BY username ASC")
    return cur.fetchall()

ALLOWED_STATUSES = ["PENDING", "OPEN", "INVESTIGATING", "RESOLVED", "FALSE POSITIVE"]
@app.patch("/api/alerts/{alert_id}/status")
def change_status(alert_id: int, data: StatusUpdate, db=Depends(get_db), auth=Depends(secure_auth_verify)):
    cur = db.cursor()
    status_upper = data.new_status.upper()
    if status_upper not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status.")
    cur.execute("SELECT assigned_to FROM detected_alerts WHERE id = %s", (alert_id,))
    alert = cur.fetchone()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    if not (auth["role"] == "admin" or alert["assigned_to"] == auth["id"]):
        raise HTTPException(status_code=403, detail="Forbidden")
    cur.execute("UPDATE detected_alerts SET status = %s WHERE id = %s", (status_upper, alert_id))
    db.commit()
    return {"message": "Status updated"}

@app.post("/api/alerts/{alert_id}/comment")
def add_comment(alert_id: int, data: CommentCreate, db=Depends(get_db), auth=Depends(secure_auth_verify)):
    cur = db.cursor()
    cur.execute("SELECT id FROM detected_alerts WHERE id = %s", (alert_id,))
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="Alert not found")
    cur.execute("INSERT INTO alert_comments (alert_id, user_id, comment_text) VALUES (%s, %s, %s)", (alert_id, auth["id"], data.comment_text))
    db.commit()
    return {"message": "Comment added"}

@app.get("/api/alerts/{alert_id}/comment")
def get_comments(alert_id: int, db=Depends(get_db), auth=Depends(secure_auth_verify)):
    cur = db.cursor()
    cur.execute("SELECT id, user_id, comment_text, created_at FROM alert_comments WHERE alert_id = %s ORDER BY created_at ASC", (alert_id,))
    return cur.fetchall()

@app.post("/api/alerts/{alert_id}/evidence")
def get_forensic_evidence(alert_id: int, filters: EvidenceFilter, db=Depends(get_db), auth=Depends(secure_auth_verify)):
    cur = db.cursor()
    cur.execute("SELECT source_ip, victim_ip, time FROM detected_alerts WHERE id = %s", (alert_id,))
    alert = cur.fetchone()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    start_window = alert['time'] - timedelta(minutes=filters.window_minutes)
    end_window = alert['time'] + timedelta(minutes=filters.window_minutes)
    where_clause = " WHERE ((src_ip = %s AND dst_ip = %s) OR (src_ip = %s AND dst_ip = %s)) AND time BETWEEN %s AND %s"
    params = [alert['source_ip'], alert['victim_ip'], alert['victim_ip'], alert['source_ip'], start_window, end_window]
    cur.execute(f"SELECT COUNT(*) FROM packets {where_clause}", params)
    total_count = cur.fetchone()['count']
    offset = (filters.page - 1) * filters.size
    cur.execute(f"SELECT * FROM packets {where_clause} ORDER BY time ASC LIMIT %s OFFSET %s", params + [filters.size, offset])
    return {"packets": cur.fetchall(), "total_count": total_count, "page": filters.page, "size": filters.size}

@app.patch("/api/alerts/{alert_id}/assign")
def assign_alert(alert_id: int, data: AssignUpdate, db=Depends(get_db), auth=Depends(secure_auth_verify)):
    cur = db.cursor()
    cur.execute("SELECT assigned_to FROM detected_alerts WHERE id = %s", (alert_id,))
    alert = cur.fetchone()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    if not (auth["role"] == "admin" or alert["assigned_to"] is None or alert["assigned_to"] == auth["id"]):
        raise HTTPException(status_code=403, detail="Forbidden")
    cur.execute("UPDATE detected_alerts SET assigned_to = %s, assigned_from = %s, assigned_at = NOW(), status = 'INVESTIGATING' WHERE id = %s", (data.user_id, auth["id"], alert_id))
    db.commit()
    return {"message": "Assignment updated"}

@app.patch("/api/user/profile")
def update_my_profile(data: ProfileUpdate, db=Depends(get_db), auth=Depends(secure_auth_verify)):
    cur = db.cursor()
    updates, params = [], []
    if data.new_username:
        updates.append("username = %s"); params.append(data.new_username)
    if data.new_password:
        updates.append("password_hash = %s"); params.append(pwd_context.hash(data.new_password))
    if not updates:
        raise HTTPException(status_code=400, detail="No changes")
    params.append(auth['id'])
    cur.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = %s", params)
    db.commit()
    return {"message": "Profile updated"}