import { useState, useMemo } from 'react';
import UserDetailSheet from './UserDetailSheet';
import './MobileAdminDashboard.css';

// Mock data generator
const generateMockUsers = (count = 50) => {
  const statuses = ['online', 'offline'];
  const locations = ['New York, US', 'London, UK', 'Tokyo, JP', 'Sydney, AU', 'Toronto, CA'];
  const devices = ['iPhone 15', 'Galaxy S24', 'Pixel 8', 'MacBook Pro', 'iPad Pro'];
  
  return Array.from({ length: count }, (_, i) => ({
    id: `user-${i + 1}`,
    username: `Player${i + 1}`,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`,
    status: statuses[Math.floor(Math.random() * statuses.length)],
    ip: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    walletBalance: Math.floor(Math.random() * 10000),
    location: locations[Math.floor(Math.random() * locations.length)],
    device: devices[Math.floor(Math.random() * devices.length)],
    joinDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    warningCount: Math.floor(Math.random() * 5),
    lastBanDate: Math.random() > 0.8 ? new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toLocaleDateString() : null,
    lastActive: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toLocaleString()
  }));
};

const MobileAdminDashboard = () => {
  const [users] = useState(() => generateMockUsers(50));
  const [selectedUser, setSelectedUser] = useState(null);
  const [filter, setFilter] = useState('all'); // 'online', 'offline', 'all'

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
        <h1 className="dashboard-title">Admin Console</h1>
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
