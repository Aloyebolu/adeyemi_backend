# **University Live Chat System - Complete Documentation**

## **📋 Project Overview**
A real-time live chat support system for university websites with multi-role attendant management, WebSocket communication, and responsive design.

## **🎯 Core Features**
1. **Real-time Messaging** - WebSocket-based live chat
2. **Multi-user Roles** - Admin, Support Agents, Users, Guests
3. **Automatic Routing** - Smart assignment to available agents
4. **File Sharing** - Support for images/documents
5. **Responsive Design** - Mobile-first approach
6. **Chat History** - Persistent message storage
7. **Typing Indicators** - Real-time feedback
8. **Admin Dashboard** - Chat management interface

## **🏗️ Architecture**

### **Backend Stack**
```
Express.js (API Server)
Socket.io (WebSocket Server)
MongoDB (Database)
Mongoose (ODM)
JWT (Authentication)
```

### **Frontend Stack**
```
Next.js (React Framework)
Socket.io-client (WebSocket Client)
Tailwind CSS (Styling)
Axios/Fetch (HTTP Client)
```

## **📁 Project Structure**

### **Backend Structure**
```
backend/
├── config/
│   └── db.js                 # MongoDB connection
├── models/
│   ├── User.js               # Extended user model
│   ├── ChatSession.js        # Chat sessions model
│   └── Message.js           # Messages model
├── controllers/
│   └── chatController.js    # Chat API controllers
├── services/
│   └── chatService.js       # Business logic
├── socket/
│   └── chatSocket.js        # Socket.io server
├── routes/
│   └── chatRoutes.js        # Chat API routes
├── middlewares/
│   ├── authenticate.js      # JWT auth middleware
│   └── auditLogger.js       # Audit logging
├── uploads/
│   └── chat/                # File uploads directory
└── app.js                   # Main Express app
```

### **Frontend Structure**
```
frontend/
├── pages/
│   ├── chat/               # Chat pages
│   │   ├── index.js       # Main chat page
│   └── _app.js            # Next.js app wrapper
├── components/
│   └── chat/
│       ├── ChatInterface.js      # Main chat UI
│       ├── ChatAttendantPanel.js # Agent interface
│       ├── MessageBubble.js      # Message component
│       ├── ChatSidebar.js        # Active chats sidebar
│       └── FileUploader.js       # File upload component
├── hooks/
│   ├── useSocket.js             # Socket.io custom hook
│   └── useChat.js              # Chat state management
├── utils/
│   ├── socketClient.js         # Socket connection utility
│   └── api.js                 # API call functions
├── styles/
│   └── globals.css            # Global styles
└── public/
    └── uploads/               # Public uploads
```

## **🔌 API Endpoints**

### **Authentication Required Endpoints**
```
GET    /api/chat/my-chats          - Get user's active chats
GET    /api/chat/history/:id      - Get chat history
POST   /api/chat/upload          - Upload chat file
```

### **Admin Only Endpoints**
```
GET    /api/chat/admin/active-chats   - Get all active chats
GET    /api/chat/admin/attendants     - Get available attendants
POST   /api/chat/admin/assign        - Manually assign chat
```

### **WebSocket Events**
**Client → Server:**
- `start_chat` - Start new chat session
- `send_message` - Send chat message
- `typing` - Typing indicator
- `mark_read` - Mark messages as read
- `join_as_attendant` - Join as support agent
- `close_chat` - Close chat session

**Server → Client:**
- `new_message` - New message received
- `user_typing` - Other user typing
- `chat_closed` - Chat session closed
- `new_chat_waiting` - New chat waiting (agents)
- `messages_read` - Messages read by others

## **🗄️ Database Schemas**

### **1. User Model (Extended)**
```javascript
{
  _id: ObjectId,
  name: String,
  email: String,
  password: String,
  role: String, // "admin", "lecturer", "student", etc.
  extra_roles: [String], // ["customer_service", "moderator"]
  chat_availability: Boolean,
  last_seen: Date,
  department: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

### **2. ChatSession Model**
```javascript
{
  _id: ObjectId,
  session_id: String, // Unique session identifier
  user_id: ObjectId, // Registered user (optional)
  guest_info: {
    email: String,
    name: String,
    phone: String,
    ip_address: String,
    user_agent: String
  },
  status: String, // "active", "waiting", "closed", "resolved"
  assigned_to: ObjectId, // Assigned attendant
  department: String,
  last_message_at: Date,
  metadata: Object, // Browser info, page URL, etc.
  createdAt: Date,
  updatedAt: Date
}
```

### **3. Message Model**
```javascript
{
  _id: ObjectId,
  session_id: ObjectId,
  sender_type: String, // "user", "attendant", "system"
  sender_id: ObjectId,
  content: String,
  message_type: String, // "text", "image", "file"
  attachments: [{
    filename: String,
    url: String,
    size: Number,
    mime_type: String
  }],
  read_by: [{
    user_id: ObjectId,
    read_at: Date
  }],
  delivered: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

## **🔐 Authentication Flow**

### **JWT Token Flow**
```
1. User logs in → Gets JWT token
2. Token stored in localStorage/cookies
3. Socket connection includes token
4. Server verifies token on connection
5. Guest users connect without token
```

### **Role Hierarchy**
```
admin → All access
dean → Department-level access
hod → Department chat access
lecturer → Can be assigned as attendant
student → Regular user
customer_service → Chat attendant (extra_role)
```

## **🔄 Chat Flow Sequence**

### **User Starts Chat**
```
1. User visits /chat page
2. Authenticated: Uses existing user data
3. Guest: Provides email (required), name/phone (optional)
4. System creates chat session
5. Finds available attendant
6. If available: Assign immediately
7. If not: Send waiting message, queue chat
```

### **Message Flow**
```
1. User types message → typing event emitted
2. User sends message → send_message event
3. Server saves to DB → emits new_message to session
4. Other participants receive real-time update
5. Message marked as delivered
6. When read → mark_read event emitted
```

### **Attendant Workflow**
```
1. User with customer_service role logs in
2. Clicks "Join as Support Agent"
3. Socket joins attendants_room
4. Receives active chats assignment
5. Can handle multiple chats simultaneously
6. Can manually close/resolve chats
```

## **🎨 Frontend Components Specification**

### **1. Main Chat Page (`/chat`)**
**Purpose:** Entry point for all chat interactions

**States:**
- **Unauthenticated:** Show guest form
- **Authenticated User:** Show "Start Chat" button
- **Support Agent:** Show "Join as Agent" button
- **Active Chat:** Show ChatInterface component

**UI Elements:**
- Header with title and close button
- Role-specific action buttons
- Guest registration form
- Responsive grid layout

### **2. ChatInterface Component**
**Purpose:** Main chat conversation UI

**Features:**
- Real-time message display
- Message input with send button
- Typing indicators
- File upload button
- Online status indicators
- Message timestamps
- Read receipts (optional)
- Emoji picker (optional)

**Layout:**
```
┌─────────────────────────────┐
│  Header: Chat Info & Close  │
├─────────────────────────────┤
│                             │
│    Messages Area (Scroll)   │
│                             │
├─────────────────────────────┤
│  Typing Indicator (if any)  │
├─────────────────────────────┤
│  Input Area + Send + File   │
└─────────────────────────────┘
```

### **3. ChatAttendantPanel Component**
**Purpose:** Support agent dashboard

**Features:**
- List of active chats
- Chat assignment notifications
- Quick response templates
- User info display
- Transfer chat option
- Close/resolve chat buttons
- Performance metrics

**Layout:**
```
┌─────────────┬─────────────────┐
│             │                 │
│  Sidebar    │                 │
│  Active     │   Selected      │
│  Chats      │   Chat          │
│  List       │   Interface     │
│             │                 │
└─────────────┴─────────────────┘
```

### **4. MessageBubble Component**
**Purpose:** Individual message display

**Variants:**
- **User Message:** Right-aligned, primary color
- **Attendant Message:** Left-aligned, gray color
- **System Message:** Centered, yellow background, italic

**Content:**
- Sender name/avatar
- Message text
- Timestamp (HH:MM)
- Read status indicator
- File attachments (if any)

### **5. FileUploader Component**
**Purpose:** Handle file uploads in chat

**Features:**
- Drag & drop support
- File type validation (images, PDF, docs)
- Size limit (10MB)
- Upload progress indicator
- Preview for images
- Multiple file selection

## **🌈 UI/UX Design Guidelines**

### **Color Scheme**
```css
/* Primary Colors */
--color-primary: #3B82F6;      /* Blue */
--color-primary-hover: #2563EB; /* Darker Blue */

/* Status Colors */
--color-success: #10B981;      /* Green */
--color-error: #EF4444;        /* Red */
--color-warning: #F59E0B;      /* Amber */
--color-info: #3B82F6;         /* Blue */

/* Backgrounds */
--color-background: #F9FAFB;   /* Light Gray */
--color-surface: #FFFFFF;      /* White */
--color-border: #E5E7EB;       /* Gray */

/* Text */
--color-text-primary: #111827; /* Gray 900 */
--color-text-secondary: #6B7280; /* Gray 500 */
```

### **Typography**
- **Font Family:** Inter, system-ui, sans-serif
- **Base Size:** 16px
- **Headings:** 
  - H1: 2rem (32px)
  - H2: 1.5rem (24px)
  - H3: 1.25rem (20px)
- **Body:** 1rem (16px)
- **Small:** 0.875rem (14px)

### **Spacing Scale**
```css
--spacing-1: 0.25rem;  /* 4px */
--spacing-2: 0.5rem;   /* 8px */
--spacing-4: 1rem;     /* 16px */
--spacing-6: 1.5rem;   /* 24px */
--spacing-8: 2rem;     /* 32px */
```

### **Breakpoints**
```css
/* Tailwind Defaults */
sm: 640px   /* Mobile */
md: 768px   /* Tablet */
lg: 1024px  /* Laptop */
xl: 1280px  /* Desktop */
2xl: 1536px /* Large Desktop */
```

## **🔧 Configuration Files**

### **1. Tailwind Configuration**
```javascript
// tailwind.config.js
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: 'rgb(var(--color-primary-rgb) / <alpha-value>)',
        'primary-hover': 'var(--color-primary-hover)',
      },
      animation: {
        'bounce-slow': 'bounce 2s infinite',
        'pulse-slow': 'pulse 3s infinite',
      }
    },
  },
  plugins: [],
}
```

### **2. Environment Variables**
```env
# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
NEXT_PUBLIC_MAX_FILE_SIZE=10485760

# Backend (.env)
PORT=5000
MONGODB_URI=your_mongodb_uri
TOKEN_KEY=your_jwt_secret
FRONTEND_URL=http://localhost:3000
MAX_CONCURRENT_CHATS=50
```

## **⚡ Performance Optimizations**

### **1. Socket Connection Management**
- Auto-reconnect on disconnect
- Connection pooling
- Event debouncing for typing indicators
- Connection status monitoring

### **2. Message Optimization**
- Virtual scrolling for long conversations
- Message pagination (load older messages on scroll)
- Message compression for large chats
- Image lazy loading

### **3. State Management**
- React Context for global state
- useReducer for complex chat state
- Memoization for expensive components
- Optimistic updates for messages

## **📱 Responsive Design Implementation**

### **Mobile (< 768px)**
```jsx
// ChatInterface mobile layout
<div className="flex flex-col h-screen">
  {/* Header - Fixed */}
  <header className="h-16 fixed top-0 left-0 right-0">
    {/* Mobile header content */}
  </header>
  
  {/* Messages - Scrollable */}
  <main className="flex-1 mt-16 mb-20 overflow-y-auto">
    {/* Messages list */}
  </main>
  
  {/* Input - Fixed bottom */}
  <footer className="h-20 fixed bottom-0 left-0 right-0">
    {/* Input area */}
  </footer>
</div>
```

### **Tablet (768px - 1024px)**
```jsx
// Two-column layout for attendants
<div className="grid grid-cols-3 gap-4 h-screen">
  {/* Sidebar - 1 column */}
  <aside className="col-span-1">
    {/* Active chats list */}
  </aside>
  
  {/* Main chat - 2 columns */}
  <main className="col-span-2">
    {/* Chat interface */}
  </main>
</div>
```

### **Desktop (> 1024px)**
```jsx
// Full dashboard layout
<div className="grid grid-cols-4 gap-6 h-screen p-4">
  {/* Sidebar */}
  <aside className="col-span-1">
    {/* Chats list + user info */}
  </aside>
  
  {/* Main chat */}
  <main className="col-span-2">
    {/* Active chat */}
  </main>
  
  {/* Side panel */}
  <aside className="col-span-1">
    {/* User details, quick replies, notes */}
  </aside>
</div>
```

## **🔍 Error Handling**

### **Socket Connection Errors**
```javascript
// Connection error handling
socket.on('connect_error', (error) => {
  setConnectionStatus('disconnected');
  showToast('Connection lost. Reconnecting...', 'warning');
  
  // Auto-reconnect logic
  setTimeout(() => {
    socket.connect();
  }, 3000);
});

// Reconnect handling
socket.on('reconnect', () => {
  setConnectionStatus('connected');
  showToast('Reconnected successfully', 'success');
  
  // Restore chat session
  if (activeSession) {
    socket.emit('restore_session', { session_id: activeSession.id });
  }
});
```

### **Message Send Errors**
```javascript
const handleSendMessage = async () => {
  try {
    setIsSending(true);
    
    const response = await socket.emitWithAck('send_message', {
      session_id: sessionId,
      content: message
    });
    
    if (response.error) {
      throw new AppError(response.error);
    }
    
    // Success - clear input
    setMessage('');
    
  } catch (error) {
    showToast(`Failed to send: ${error.message}`, 'error');
    
    // Store message locally for retry
    addToPendingMessages(message);
    
  } finally {
    setIsSending(false);
  }
};
```

## **📊 Monitoring & Analytics**

### **Key Metrics to Track**
```javascript
const chatMetrics = {
  // Performance metrics
  averageResponseTime: 'calculate',
  chatDuration: 'track',
  messagesPerSession: 'count',
  
  // User satisfaction
  resolutionRate: 'percentage',
  userSatisfaction: 'survey',
  chatAbandonment: 'rate',
  
  // Agent performance
  chatsPerAgent: 'count',
  averageHandlingTime: 'calculate',
  transferRate: 'percentage'
};
```

### **Real-time Dashboard**
```jsx
// Admin dashboard metrics component
function ChatMetricsDashboard() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Active Chats"
        value={activeChats}
        trend="+12%"
        icon="💬"
      />
      
      <MetricCard
        title="Waiting Chats"
        value={waitingChats}
        trend="+5%"
        icon="⏳"
      />
      
      <MetricCard
        title="Avg Response Time"
        value="2m 34s"
        trend="-15%"
        icon="⚡"
      />
      
      <MetricCard
        title="Satisfaction"
        value="94%"
        trend="+3%"
        icon="⭐"
      />
    </div>
  );
}
```

## **🔒 Security Considerations**

### **Input Validation**
```javascript
// Validate guest registration
const validateGuestData = (data) => {
  const errors = [];
  
  // Email validation
  if (!data.email || !isValidEmail(data.email)) {
    errors.push('Valid email is required');
  }
  
  // Name validation
  if (data.name && data.name.length > 100) {
    errors.push('Name too long');
  }
  
  // Phone validation
  if (data.phone && !isValidPhone(data.phone)) {
    errors.push('Invalid phone format');
  }
  
  return errors;
};
```

### **File Upload Security**
```javascript
// Secure file upload validation
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'text/plain'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const validateFile = (file) => {
  // Check file type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new AppError('File type not allowed');
  }
  
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    throw new AppError('File too large (max 10MB)');
  }
  
  // Check filename for injections
  if (/[<>:"/\\|?*]/.test(file.name)) {
    throw new AppError('Invalid filename');
  }
  
  return true;
};
```

## **🚀 Deployment Checklist**

### **Pre-deployment**
- [ ] Update environment variables for production
- [ ] Set up MongoDB Atlas or production database
- [ ] Configure SSL certificates
- [ ] Set up file storage (S3/Cloudinary)
- [ ] Configure CORS for production domains
- [ ] Set up logging and monitoring

### **Frontend Deployment (Vercel)**
```bash
# Build for production
npm run build

# Deploy to Vercel
vercel --prod

# Set environment variables in Vercel dashboard
```

### **Backend Deployment**
```bash
# Install PM2 for process management
npm install -g pm2

# Start server with PM2
pm2 start server.js --name "chat-server"

# Save PM2 configuration
pm2 save
pm2 startup

# Configure NGINX proxy (if needed)
```

## **📝 Testing Guide**

### **Unit Tests**
```javascript
// Example test for chat service
describe('ChatService', () => {
  it('should create new chat session', async () => {
    const session = await chatService.createChatSession({
      email: 'test@example.com',
      name: 'Test User'
    });
    
    expect(session).toHaveProperty('session_id');
    expect(session.status).toBe('waiting');
  });
  
  it('should assign chat to available attendant', async () => {
    const attendant = await chatService.findAvailableAttendant();
    
    if (attendant) {
      expect(attendant.extra_roles).toContain('customer_service');
      expect(attendant.chat_availability).toBe(true);
    }
  });
});
```

### **Integration Tests**
```javascript
// Test socket.io events
describe('Socket Events', () => {
  let clientSocket;
  
  beforeAll((done) => {
    clientSocket = io(SOCKET_URL);
    clientSocket.on('connect', done);
  });
  
  it('should start chat and receive session', (done) => {
    clientSocket.emit('start_chat', {
      email: 'test@example.com'
    }, (response) => {
      expect(response.success).toBe(true);
      expect(response.session_id).toBeDefined();
      done();
    });
  });
});
```

## **🛠️ Development Scripts**

### **Package.json Scripts**
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "socket:dev": "nodemon socket/server.js",
    "api:dev": "nodemon api/server.js",
    "dev:all": "concurrently \"npm run api:dev\" \"npm run socket:dev\" \"npm run dev\""
  }
}
```

## **📚 API Documentation**

### **Complete API Reference**
Available in Postman collection format at:
`/docs/api/postman-collection.json`

### **WebSocket Events Documentation**
Available at:
`/docs/websocket/events.md`

## **🎯 Success Metrics**

### **Phase 1 Launch Goals**
- [ ] 100 concurrent users supported
- [ ] < 2 second average response time
- [ ] 95% chat delivery success rate
- [ ] 90% user satisfaction score

### **Phase 2 Enhancements**
- [ ] Chatbot integration for common queries
- [ ] Screen sharing capability
- [ ] Voice/video chat support
- [ ] Advanced analytics dashboard
- [ ] Mobile app development

---

## **📞 Support & Maintenance**

### **Common Issues & Solutions**
1. **Socket connection drops** - Implement auto-reconnect
2. **File upload fails** - Check file size and type restrictions
3. **Chat not assigning** - Verify attendant availability status
4. **Messages not delivering** - Check WebSocket connection status

### **Monitoring Tools**
- **Backend:** PM2 logs, MongoDB Atlas metrics
- **Frontend:** Vercel analytics, Google Analytics
- **Real-time:** Socket.io admin UI

---

This documentation provides a comprehensive guide to build the perfect frontend for your university chat system. Each component is modular and can be built incrementally. Start with the core ChatInterface, then add features like file upload, attendant panel, and admin dashboard.

**Next Steps:**
1. Set up the basic Next.js project structure
2. Implement authentication context
3. Build the ChatInterface component
4. Add Socket.io integration
5. Implement file upload feature
6. Build admin dashboard
7. Add analytics and monitoring

Would you like me to provide more detailed implementation for any specific component or feature?