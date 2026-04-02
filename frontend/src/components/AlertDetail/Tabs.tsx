import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAlertEvidence } from '../../store/evidenceSlice';
import { fetchAlertComments, postAlertComment } from '../../store/commentsSlice';
import { type RootState, type AppDispatch } from '../../store';
import { Zap, Box, MessageSquare, Send, Loader2, User,ShieldAlert } from 'lucide-react';
import './Tabs.css';

interface TabsProps {
  alert: any;
}

const Tabs = ({ alert }: TabsProps) => {
  const dispatch = useDispatch<AppDispatch>();
  const [activeTab, setActiveTab] = useState<'packets' | 'ai' | 'comments'>('ai');
  const [newComment, setNewComment] = useState("");

  const { packets, loading: evidenceLoading } = useSelector((state: RootState) => state.evidence);
  const { items: comments, loading: commentsLoading, submitting } = useSelector((state: RootState) => state.comments);
  const { list: allUsers } = useSelector((state: RootState) => state.users);

  useEffect(() => {
    if (activeTab === 'packets') dispatch(fetchAlertEvidence(alert.id));
    if (activeTab === 'comments') dispatch(fetchAlertComments(alert.id));
  }, [activeTab, alert.id, dispatch]);

  const getUsernameById = (userId: number) => {
    const foundUser = allUsers.find(u => u.id === userId);
    return foundUser ? foundUser.username : `Analyst_${userId}`;
  };

  const handleSendComment = async () => {
    if (!newComment.trim() || submitting) return;
    try {
      await dispatch(postAlertComment({ id: alert.id, text: newComment })).unwrap();
      setNewComment("");
      dispatch(fetchAlertComments(alert.id)); 
    } catch (err) {
      console.error("Failed to post comment:", err);
    }
  };

  return (
    <div className="tabs-container">
      <div className="tabs-nav-row">
        <button 
          className={activeTab === 'packets' ? 'active' : ''} 
          onClick={() => setActiveTab('packets')}
        >
          <Box size={14}/> Related Packets
        </button>
        <button 
          className={activeTab === 'ai' ? 'active' : ''} 
          onClick={() => setActiveTab('ai')}
        >
          <Zap size={14}/> AI Analysis
        </button>
        <button 
          className={activeTab === 'comments' ? 'active' : ''} 
          onClick={() => setActiveTab('comments')}
        >
          <MessageSquare size={14}/> Comments
        </button>
      </div>

      <div className="tabs-content-viewport">
        {activeTab === 'packets' && (
          <div className="tab-pane packets-pane">
            {evidenceLoading ? (
              <div className="tab-loader"><Loader2 className="animate-spin" /></div>
            ) : (
              <div className="packet-table-wrapper">
                <table className="packet-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Source IP:Port</th>
                      <th>Dest IP:Port</th>
                      <th>Proto</th>
                      <th>Flags</th>
                      <th>Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packets && packets.map((p: any, i: number) => (
                      <tr key={i}>
                        <td className="mono">{new Date(p.time).toLocaleTimeString()}</td>
                        <td className="mono">{p.src_ip}:{p.src_port}</td>
                        <td className="mono">{p.dst_ip}:{p.dst_port}</td>
                        <td>{p.proto}</td>
                        <td className="flags-cell">{p.flags}</td>
                        <td className="mono">{p.size}b</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {packets.length === 0 && <p className="empty-tab-text">No packets captured for this window.</p>}
              </div>
            )}
          </div>
        )}

{activeTab === 'ai' && (
  <div className="tab-pane ai-pane">
    {alert.ai_label === false && (
      <div className="ai-verdict-warning">
        <ShieldAlert size={16} />
        <span>AI VERDICT: POTENTIAL FALSE POSITIVE DETECTED</span>
      </div>
    )}

    {alert.ai_analysis ? (
      <div className="ai-content-wrapper">
        <div className="ai-bubble summary">
          <div className="ai-bubble-header">
            <Zap size={14} className="text-sky-400" />
            <label>EXECUTIVE SUMMARY</label>
          </div>
          <p>{alert.ai_analysis.summary || "No summary provided."}</p>
        </div>

        <div className="ai-bubble notice">
          <div className="ai-bubble-header">
            <MessageSquare size={14} className="text-amber-400" />
            <label>RECOMMENDED EMPLOYEE NOTICE</label>
          </div>
          <p>{alert.ai_analysis.employee_notice || "No notice template available."}</p>
        </div>
      </div>
    ) : (
      <div className="ai-pending-state">
        <Loader2 className="animate-spin text-slate-700" size={32} />
        <p>AI Engine is processing this alert...</p>
        <span>This usually takes 30-60 seconds depending on traffic.</span>
      </div>
    )}
  </div>
)}

{activeTab === 'comments' && (
  <div className="tab-pane comments-pane">
    <div className="comments-thread">
      {commentsLoading ? (
        <div className="tab-loader"><Loader2 className="animate-spin mx-auto py-10" /></div>
      ) : (
        comments.map((c: any) => (
          <div key={c.id} className="comment-bubble">
            <div className="comment-meta">
              <span className="user-tag">
                <User size={12} className="opacity-50" /> 
                {getUsernameById(c.user_id)}
              </span>
              <span className="timestamp">
                {new Date(c.created_at).toLocaleString([], { 
                  year: 'numeric', month: 'numeric', day: 'numeric', 
                  hour: '2-digit', minute: '2-digit', second: '2-digit' 
                })}
              </span>
            </div>
            <p className="comment-body">{c.comment_text}</p>
          </div>
        ))
      )}
    </div>

    <div className="comment-input-area">
      <input 
        type="text" 
        placeholder="Enter forensic note..." 
        value={newComment}
        onChange={(e) => setNewComment(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
        disabled={submitting}
      />
      <button 
        onClick={handleSendComment} 
        disabled={submitting || !newComment.trim()}
        className="send-btn"
      >
        {submitting ? <Loader2 className="animate-spin" size={16}/> : <Send size={16}/>}
      </button>
    </div>
  </div>
)}

      </div>
    </div>
  );
};

export default Tabs;