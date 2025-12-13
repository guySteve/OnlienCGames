import { useState, useMemo, useEffect } from 'react';
import UserDetailSheet from './UserDetailSheet';
import './MobileAdminDashboard.css';

const MobileAdminDashboard = ({ onBack }) => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [filter, setFilter] = useState('all'); // 'online', 'offline', 'all'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch users from API
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/admin/users?limit=100', {
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Failed to fetch users');
        }

        const data = await response.json();

        // Transform API data to match our UI format
        const transformedUsers = data.users.map(user => ({
          id: user.id,
          username: user.displayName || user.nickname || user.email,
          avatar: user.customAvatar || user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
          status: 'offline', // We'll update this when we have online status tracking
          ip: 'N/A', // Add IP tracking if needed
          walletBalance: user.chipBalance || 0,
          location: 'N/A', // Add location tracking if needed
          device: 'N/A', // Add device tracking if needed
          joinDate: user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'N/A',
          warningCount: user.warnCount || 0,
          lastBanDate: user.isBanned ? 'Currently Banned' : null,
          lastActive: user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never',
          email: user.email,
          isAdmin: user.isAdmin,
          isBanned: user.isBanned
        }));

        setUsers(transformedUsers);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch users:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Filter users based on selected tab
  const filteredUsers = useMemo(() => {
    if (filter === 'all') return users;
    return users.filter(user => user.status === filter);
  }, [users, filter]);

  // Calculate stats
  const stats = useMemo(() => ({
    online: users.filter(u => u.status === 'online').length,
    offline: users.filter(u => u.status === 'offline').length,
    total: users.length
  }), [users]);

  const handleUserClick = (user) => {
    setSelectedUser(user);
  };

  const handleCloseSheet = () => {
    setSelectedUser(null);
  };

  return (
    <div className="mobile-admin-dashboard">
      {/* Fixed Header */}
      <header className="dashboard-header">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="text-slate-400 hover:text-white">
              ← Back
            </button>
          )}
          <h1 className="dashboard-title">Admin Console</h1>
        </div>
        <div className="dashboard-stats">
          <span className="stat-badge online">
            <span className="stat-dot"></span>
            {stats.online} Online
          </span>
          <span className="stat-badge offline">
            {stats.offline} Offline
          </span>
        </div>
      </header>

      {/* Fixed Filter Bar - iOS Segmented Control Style */}
      <div className="filter-bar">
        <div className="segmented-control">
          <button
            className={`segment ${filter === 'online' ? 'active' : ''}`}
            onClick={() => setFilter('online')}
          >
            Online
          </button>
          <button
            className={`segment ${filter === 'offline' ? 'active' : ''}`}
            onClick={() => setFilter('offline')}
          >
            Offline
          </button>
          <button
            className={`segment ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
        </div>
      </div>

      {/* Scrollable User List */}
      <div className="user-list-container">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="text-slate-400">Loading users...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center p-12">
            <div className="text-red-400">Error: {error}</div>
          </div>
        ) : (
          <div className="user-list">
            {filteredUsers.map((user) => (
            <div
              key={user.id}
              className="user-row"
              onClick={() => handleUserClick(user)}
            >
              {/* Avatar */}
              <div className="user-avatar">
                <img src={user.avatar} alt={user.username} />
                <span className={`status-dot ${user.status}`}></span>
              </div>

              {/* User Info */}
              <div className="user-info">
                <div className="user-name">{user.username}</div>
                <div className="user-meta">{user.ip}</div>
              </div>

              {/* Status Indicator */}
              <div className="user-status">
                <span className={`status-badge ${user.status}`}>
                  {user.status}
                </span>
              </div>
            </div>
            ))}
          </div>
        )}
      </div>

      {/* User Detail Sheet */}
      {selectedUser && (
        <UserDetailSheet
          user={selectedUser}
          onClose={handleCloseSheet}
        />
      )}
    </div>
  );
};

export default MobileAdminDashboard;
