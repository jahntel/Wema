# Community Aid Platform

A comprehensive web application designed to connect people in communities to share resources, offer services, and build stronger communities through technology.

## 🚀 Features

- **Real-time Chat & Alerts** - Socket.io implementation with voice notes, reactions, typing indicators
- **User Authentication** - JWT-based auth with role-based access control
- **Google Maps Integration** - Drop-off points, resource locations, geospatial queries
- **Multi-language Support** - English, Swahili, French, Arabic with i18n
- **Offline Capability** - PWA with service worker, IndexedDB storage
- **Impact Tracking** - Comprehensive analytics and visualization
- **Voice Notes & Requests** - Audio messaging with accessibility features
- **AI-Powered Features** - Chatbot assistance and need forecasting

## 🏗️ Architecture

### Backend (Node.js/Express)
- **Express.js** server with RESTful APIs
- **MongoDB** database with geospatial support
- **Socket.io** for real-time communication
- **JWT** authentication with role-based access
- **Cloudinary** for media storage
- **OpenAI** integration for AI features

### Frontend (Next.js/React)
- **Next.js 14** with TypeScript
- **Tailwind CSS** for styling
- **Progressive Web App** (PWA) capabilities
- **Real-time updates** with Socket.io
- **Responsive design** with accessibility features

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 18+ 
- MongoDB (local or cloud)
- npm or yarn

### 1. Clone the repository
```bash
git clone <repository-url>
cd community-aid-platform
```

### 2. Install dependencies
```bash
# Install root dependencies
npm install

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### 3. Environment Configuration

#### Server Environment (server/.env)
```env
# Database
MONGODB_URI=mongodb://localhost:27017/community-aid

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Server Configuration
PORT=5000
CLIENT_URL=http://localhost:3000

# Optional: Cloudinary (for image uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Optional: OpenAI (for AI features)
OPENAI_API_KEY=your_openai_api_key

# Environment
NODE_ENV=development
```

#### Client Environment (client/.env.local)
```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:5000/api

# Client Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Socket.io Configuration
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000

# Environment
NODE_ENV=development
```

### 4. Start the application

#### Development Mode
```bash
# Start both client and server concurrently
npm run dev

# Or start individually:
# Server
npm run server:dev

# Client
npm run client:dev
```

#### Production Mode
```bash
# Build client
npm run build

# Start production servers
npm start
```

## 🚀 Deployment

### Vercel Deployment

1. **Prepare for deployment:**
   ```bash
   # Ensure all dependencies are installed
   npm run install:all
   ```

2. **Deploy to Vercel:**
   - Connect your GitHub repository to Vercel
   - Configure environment variables in Vercel dashboard
   - The `vercel.json` configuration will handle the deployment

3. **Required Environment Variables for Vercel:**
   ```
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   NODE_ENV=production
   NEXT_PUBLIC_API_URL=https://your-vercel-app.vercel.app/api
   ```

### Render Deployment

1. **Connect repository to Render**
2. **Configure using render.yaml:**
   - The `render.yaml` file contains all necessary configuration
   - Render will automatically create both frontend and backend services
   - Database will be provisioned automatically

3. **Required Environment Variables:**
   - Most variables are configured in `render.yaml`
   - Add any optional API keys (Cloudinary, OpenAI) in Render dashboard

### Docker Deployment

1. **Build and run with Docker:**
   ```bash
   # Build the image
   docker build -t community-aid .

   # Run the container
   docker run -p 3000:3000 -p 5000:5000 community-aid
   ```

2. **Docker Compose (recommended):**
   ```bash
   docker-compose up -d
   ```

## 🔧 Configuration

### Database Setup
The application uses MongoDB with the following collections:
- Users (with geospatial indexing)
- Resources (with location data)
- Chats (real-time messaging)
- Challenges (community engagement)
- Impact (analytics tracking)

### API Endpoints
- **Authentication:** `/api/auth/*`
- **Users:** `/api/users/*`
- **Resources:** `/api/resources/*`
- **Chat:** `/api/chat/*`
- **Challenges:** `/api/challenges/*`
- **Impact:** `/api/impact/*`
- **AI Features:** `/api/ai/*`
- **Maps:** `/api/maps/*`

## 🧪 Testing

```bash
# Run tests (when available)
npm test

# Run linting
npm run lint
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For deployment issues or questions:
1. Check the logs in your deployment platform
2. Verify all environment variables are set correctly
3. Ensure MongoDB connection is working
4. Check that all dependencies are installed

## 🔒 Security

- JWT tokens for authentication
- Input validation and sanitization
- Rate limiting on API endpoints
- CORS configuration
- Environment variable protection

## 🌟 Features Roadmap

- [ ] Mobile app development
- [ ] Blockchain integration
- [ ] Advanced AI features
- [ ] Video calling
- [ ] Multi-tenant support
- [ ] Enhanced analytics

---

**Ready to build stronger communities through technology! 🚀**