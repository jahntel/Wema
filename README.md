# Community Aid Platform

A comprehensive web application connecting people in communities like Mathare to share resources, offer services, and build stronger communities through technology.

## 🌟 Features

### Core Features
- **Real-time Chat & Alerts** - Built with Socket.io for instant communication
- **User Authentication** - Role-based access control (donor, receiver, admin)
- **Google Maps Integration** - Interactive maps showing drop-off points and nearby resources
- **Multi-language Support** - Including accessibility features for disabilities
- **Offline Capability** - PWA with offline functionality
- **Impact Tracking** - Measure and visualize community contributions
- **Voice Notes & Requests** - Audio messaging for accessibility
- **Local Hero Profiles** - Recognize community champions

### Advanced Features
- **Mystery Drops** - Surprise kindness challenges
- **Chatbot Assistant** - AI-powered help and guidance
- **AI Need Forecasting** - Predictive analytics for resource needs
- **Challenge System** - Gamified community engagement
- **Resource Matching** - Smart matching between donors and receivers
- **Drop-off Point Management** - Manage collection/distribution centers

## 🚀 Tech Stack

### Backend
- **Node.js** with Express.js
- **MongoDB** with Mongoose ODM
- **Socket.io** for real-time communication
- **JWT** for authentication
- **Cloudinary** for media storage
- **OpenAI API** for AI features

### Frontend
- **Next.js 14** with TypeScript
- **React 18** with modern hooks
- **Tailwind CSS** for styling
- **Zustand** for state management
- **React Query** for data fetching
- **Mapbox GL** for maps
- **Framer Motion** for animations

### PWA & Offline
- **Next-PWA** for Progressive Web App
- **Workbox** for service worker
- **Dexie** for offline database
- **IndexedDB** for local storage

## 🛠️ Installation & Setup

### Prerequisites
- Node.js (v18 or higher)
- MongoDB (v5.0 or higher)
- npm or yarn package manager

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/community-aid-platform.git
cd community-aid-platform
```

### 2. Install Dependencies
```bash
# Install all dependencies (root, server, and client)
npm run install:all

# Or install individually
npm install
cd server && npm install
cd ../client && npm install
```

### 3. Environment Setup

#### Server Environment
Create `server/.env` file:
```env
# Database
MONGODB_URI=mongodb://localhost:27017/community-aid

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-here

# Server Configuration
PORT=5000
CLIENT_URL=http://localhost:3000

# Cloudinary (for image uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# OpenAI API (for chatbot and AI features)
OPENAI_API_KEY=your_openai_api_key

# Google Maps API
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# SMS Configuration (Twilio)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
```

#### Client Environment
Create `client/.env.local` file:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_token
```

### 4. Start the Application
```bash
# Start both server and client in development mode
npm run dev

# Or start individually
npm run server:dev  # Backend only
npm run client:dev  # Frontend only
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## 📱 Usage Guide

### For Community Members (Receivers)
1. **Register** with your location and accessibility needs
2. **Browse Resources** available in your area
3. **Request Items** or services you need
4. **Chat** with donors and other community members
5. **Track Impact** of help received

### For Donors
1. **Create Account** and set role as "donor"
2. **Add Resources** you want to share
3. **Set Drop-off Points** for convenient collection
4. **Monitor Requests** and respond to needs
5. **View Impact** of your contributions

### For Administrators
1. **Manage Users** and verify accounts
2. **Moderate Content** and resolve disputes
3. **Analyze Data** and generate reports
4. **Create Challenges** and campaigns
5. **Monitor System** health and usage

## 🔧 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/profile` - Get user profile

### Resource Endpoints
- `GET /api/resources` - Get all resources
- `POST /api/resources` - Create new resource
- `GET /api/resources/:id` - Get specific resource
- `PUT /api/resources/:id` - Update resource
- `DELETE /api/resources/:id` - Delete resource

### Chat Endpoints
- `GET /api/chat/` - Get user's chats
- `POST /api/chat/` - Create new chat
- `GET /api/chat/:id` - Get chat messages
- `POST /api/chat/:id/message` - Send message

### Challenge Endpoints
- `GET /api/challenges` - Get active challenges
- `POST /api/challenges` - Create new challenge
- `POST /api/challenges/:id/join` - Join challenge
- `PUT /api/challenges/:id/progress` - Update progress

## 🌍 Localization

The platform supports multiple languages:
- **English** (en)
- **Swahili** (sw)
- **French** (fr)
- **Arabic** (ar)

### Adding New Languages
1. Create translation files in `client/public/locales/[lang]/`
2. Add language to `i18n.js` configuration
3. Update language selector component

## ♿ Accessibility Features

### Visual Impairments
- Screen reader compatibility
- High contrast mode
- Large text options
- Alt text for images

### Hearing Impairments
- Visual notifications
- Text transcriptions for audio
- Sign language support indicators

### Motor Impairments
- Keyboard navigation
- Voice commands
- Touch-friendly interfaces

### Cognitive Impairments
- Simple, clear language
- Consistent navigation
- Progress indicators

## 🔒 Security Features

- **JWT Authentication** with secure token management
- **Password Hashing** using bcrypt
- **Input Validation** and sanitization
- **Rate Limiting** to prevent abuse
- **HTTPS Enforcement** in production
- **CORS Configuration** for API security

## 📊 Monitoring & Analytics

### Built-in Analytics
- User engagement metrics
- Resource sharing statistics
- Impact measurement
- Geographic distribution
- Challenge participation rates

### Performance Monitoring
- API response times
- Database query optimization
- Real-time connection monitoring
- Error tracking and logging

## 🚀 Deployment

### Production Deployment
1. **Database Setup** - MongoDB Atlas or self-hosted
2. **Environment Variables** - Set production values
3. **Build Application** - `npm run build`
4. **Deploy Backend** - To Heroku, AWS, or similar
5. **Deploy Frontend** - To Vercel, Netlify, or similar

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up --build

# Or build individual containers
docker build -t community-aid-server ./server
docker build -t community-aid-client ./client
```

## 🤝 Contributing

### Development Guidelines
1. **Fork** the repository
2. **Create** a feature branch
3. **Follow** coding standards
4. **Write** tests for new features
5. **Submit** pull request

### Code Style
- Use TypeScript for type safety
- Follow ESLint and Prettier configurations
- Write descriptive commit messages
- Add documentation for new features

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Community Members** for feedback and testing
- **Open Source Libraries** that made this possible
- **Mathare Community** for inspiration
- **Contributors** who helped build this platform

## 📞 Support

For support, email support@communityaid.com or join our [Discord community](https://discord.gg/communityaid).

## 🔄 Version History

### v1.0.0 (Current)
- Initial release with all core features
- Real-time chat and notifications
- Maps integration and offline support
- AI-powered need forecasting
- Challenge system and impact tracking

### Roadmap
- [ ] Mobile app development
- [ ] Advanced AI features
- [ ] Blockchain integration
- [ ] Multi-tenant support
- [ ] Advanced analytics dashboard

---

**Made with ❤️ for stronger communities**