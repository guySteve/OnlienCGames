import { motion, useMotionValue, useTransform } from 'framer-motion';
import './UserDetailSheet.css';

const UserDetailSheet = ({ user, onClose }) => {
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, 300], [0.6, 0]);

  const handleDragEnd = (event, info) => {
    // Close if dragged down more than 150px
    if (info.offset.y > 150) {
      onClose();
    }
  };

  const handleAction = async (action) => {
    console.log(`Action: ${action} on user:`, user.username);

    try {
      switch(action) {
        case 'kick':
          alert(`Kicking ${user.username}...`);
          break;
        case 'ban':
          if (!window.confirm(`Are you sure you want to ban ${user.username}?`)) return;
          const banResponse = await fetch(`/api/admin/ban/${user.id}`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'Banned by admin' })
          });
          if (banResponse.ok) {
            alert(`${user.username} has been banned`);
            onClose();
          }
          break;
        case 'unban':
          const unbanResponse = await fetch(`/api/admin/unban/${user.id}`, {
            method: 'POST',
            credentials: 'include'
          });
          if (unbanResponse.ok) {
            alert(`${user.username} has been unbanned`);
            onClose();
          }
          break;
        case 'toggleAdmin':
          const newAdminStatus = !user.isAdmin;
          if (!window.confirm(`Are you sure you want to ${newAdminStatus ? 'promote' : 'demote'} ${user.username} ${newAdminStatus ? 'to' : 'from'} admin?`)) return;
          const adminResponse = await fetch(`/api/admin/set-admin/${user.id}`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isAdmin: newAdminStatus })
          });
          if (adminResponse.ok) {
            alert(`${user.username} is now ${newAdminStatus ? 'an admin' : 'no longer an admin'}`);
            onClose();
          }
          break;
        case 'message':
          alert(`Opening message to ${user.username}...`);
          break;
        case 'spectate':
          alert(`Spectating ${user.username}...`);
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Action failed:', error);
      alert('Action failed. Please try again.');
    }
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="sheet-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        style={{ opacity }}
      />

      {/* Bottom Sheet */}
      <motion.div
        className="user-detail-sheet"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.5 }}
        onDragEnd={handleDragEnd}
        style={{ y }}
      >
        {/* Drag Handle */}
        <div className="sheet-handle">
          <div className="handle-bar"></div>
        </div>

        {/* Sheet Content */}
        <div className="sheet-content">
          {/* Widget A: Identity */}
          <div className="widget widget-identity">
            <div className="identity-avatar">
              <img src={user.avatar} alt={user.username} />
              <span className={`status-indicator ${user.status}`}></span>
            </div>
            <h2 className="identity-username">{user.username}</h2>
            <p className="identity-meta">Member since {user.joinDate}</p>
            <p className="identity-meta secondary">Last active: {user.lastActive}</p>
          </div>

          {/* Bento Grid Layout */}
          <div className="bento-grid">
            {/* Widget B: Vitals */}
            <div className="widget widget-vitals">
              <div className="widget-header">
                <span className="widget-icon">💰</span>
                <span className="widget-title">Wallet</span>
              </div>
              <div className="widget-value">${user.walletBalance.toLocaleString()}</div>
            </div>

            <div className="widget widget-vitals">
              <div className="widget-header">
                <span className="widget-icon">📍</span>
                <span className="widget-title">Location</span>
              </div>
              <div className="widget-value-small">{user.location}</div>
            </div>

            <div className="widget widget-vitals">
              <div className="widget-header">
                <span className="widget-icon">📱</span>
                <span className="widget-title">Device</span>
              </div>
              <div className="widget-value-small">{user.device}</div>
            </div>

            <div className="widget widget-vitals">
              <div className="widget-header">
                <span className="widget-icon">🌐</span>
                <span className="widget-title">IP Address</span>
              </div>
              <div className="widget-value-small">{user.ip}</div>
            </div>
          </div>

          {/* Widget C: Risk/Moderation */}
          <div className="widget widget-risk">
            <div className="risk-grid">
              <div className="risk-item">
                <span className="risk-label">Warnings</span>
                <span className={`risk-value ${user.warningCount > 0 ? 'danger' : ''}`}>
                  {user.warningCount}
                </span>
              </div>
              <div className="risk-item">
                <span className="risk-label">Last Ban</span>
                <span className="risk-value">
                  {user.lastBanDate || 'Never'}
                </span>
              </div>
            </div>
          </div>

          {/* Widget D: Actions - Big Buttons Grid */}
          <div className="widget widget-actions">
            <div className="actions-grid">
              {user.isBanned ? (
                <button
                  className="action-btn action-unban"
                  onClick={() => handleAction('unban')}
                >
                  <span className="action-icon">✅</span>
                  <span className="action-label">Unban</span>
                </button>
              ) : (
                <button
                  className="action-btn action-ban"
                  onClick={() => handleAction('ban')}
                >
                  <span className="action-icon">🚫</span>
                  <span className="action-label">Ban</span>
                </button>
              )}
              <button
                className={`action-btn ${user.isAdmin ? 'action-demote' : 'action-promote'}`}
                onClick={() => handleAction('toggleAdmin')}
              >
                <span className="action-icon">{user.isAdmin ? '👤' : '👑'}</span>
                <span className="action-label">{user.isAdmin ? 'Demote' : 'Make Admin'}</span>
              </button>
              <button
                className="action-btn action-message"
                onClick={() => handleAction('message')}
              >
                <span className="action-icon">💬</span>
                <span className="action-label">Message</span>
              </button>
              <button
                className="action-btn action-spectate"
                onClick={() => handleAction('spectate')}
              >
                <span className="action-icon">👁️</span>
                <span className="action-label">Spectate</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
};

export default UserDetailSheet;
