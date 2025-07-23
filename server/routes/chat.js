const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const User = require('../models/User');
const auth = require('../middleware/auth');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Get all chats for a user
router.get('/', auth, async (req, res) => {
  try {
    const chats = await Chat.find({
      participants: req.user.id
    })
    .populate('participants', 'name profilePicture')
    .populate('lastMessage.sender', 'name')
    .sort({ 'lastMessage.timestamp': -1 });

    res.json(chats);
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get or create chat between users
router.post('/create', auth, async (req, res) => {
  try {
    const { participantId, resourceId } = req.body;

    if (!participantId) {
      return res.status(400).json({ error: 'Participant ID is required' });
    }

    if (participantId === req.user.id) {
      return res.status(400).json({ error: 'Cannot create chat with yourself' });
    }

    // Check if chat already exists
    let chat = await Chat.findOne({
      participants: { $all: [req.user.id, participantId] },
      ...(resourceId && { resourceId })
    }).populate('participants', 'name profilePicture');

    if (!chat) {
      // Create new chat
      chat = new Chat({
        participants: [req.user.id, participantId],
        resourceId: resourceId || null,
        messages: []
      });

      await chat.save();
      await chat.populate('participants', 'name profilePicture');
    }

    res.json(chat);
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get chat by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id)
      .populate('participants', 'name profilePicture')
      .populate('messages.sender', 'name profilePicture');

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Check if user is participant
    if (!chat.participants.some(p => p._id.toString() === req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(chat);
  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get messages for a chat with pagination
router.get('/:id/messages', auth, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const chat = await Chat.findById(req.params.id);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Check if user is participant
    if (!chat.participants.includes(req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get messages with pagination (reverse order for latest first)
    const messages = chat.messages
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(skip, skip + parseInt(limit))
      .reverse();

    // Populate sender information
    await Chat.populate(messages, {
      path: 'sender',
      select: 'name profilePicture'
    });

    res.json({
      messages,
      pagination: {
        current: parseInt(page),
        hasMore: chat.messages.length > skip + parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send message
router.post('/:id/messages', auth, upload.single('file'), async (req, res) => {
  try {
    const { content, messageType = 'text' } = req.body;
    
    const chat = await Chat.findById(req.params.id);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Check if user is participant
    if (!chat.participants.includes(req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let fileUrl = null;
    if (req.file) {
      try {
        const result = await new Promise((resolve, reject) => {
          const uploadOptions = {
            folder: 'community-aid/chat',
            resource_type: messageType === 'voice' ? 'video' : 'auto'
          };

          cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          ).end(req.file.buffer);
        });
        fileUrl = result.secure_url;
      } catch (uploadError) {
        console.error('File upload error:', uploadError);
        return res.status(500).json({ error: 'File upload failed' });
      }
    }

    const message = {
      sender: req.user.id,
      content: content || '',
      messageType,
      fileUrl,
      timestamp: new Date(),
      readBy: [req.user.id]
    };

    chat.messages.push(message);
    chat.lastMessage = {
      content: messageType === 'text' ? content : `Sent a ${messageType}`,
      sender: req.user.id,
      timestamp: new Date()
    };

    await chat.save();

    // Populate sender info for response
    await chat.populate('messages.sender', 'name profilePicture');
    const newMessage = chat.messages[chat.messages.length - 1];

    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark messages as read
router.put('/:id/read', auth, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Check if user is participant
    if (!chat.participants.includes(req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Mark all messages as read by this user
    chat.messages.forEach(message => {
      if (!message.readBy.includes(req.user.id)) {
        message.readBy.push(req.user.id);
      }
    });

    await chat.save();
    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete message
router.delete('/:chatId/messages/:messageId', auth, async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Check if user is participant
    if (!chat.participants.includes(req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messageIndex = chat.messages.findIndex(
      msg => msg._id.toString() === messageId
    );

    if (messageIndex === -1) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const message = chat.messages[messageIndex];

    // Check if user owns the message
    if (message.sender.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Can only delete your own messages' });
    }

    chat.messages.splice(messageIndex, 1);
    
    // Update last message if deleted message was the last one
    if (chat.messages.length > 0) {
      const lastMsg = chat.messages[chat.messages.length - 1];
      chat.lastMessage = {
        content: lastMsg.messageType === 'text' ? lastMsg.content : `Sent a ${lastMsg.messageType}`,
        sender: lastMsg.sender,
        timestamp: lastMsg.timestamp
      };
    } else {
      chat.lastMessage = null;
    }

    await chat.save();
    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete chat
router.delete('/:id', auth, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Check if user is participant
    if (!chat.participants.includes(req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await Chat.findByIdAndDelete(req.params.id);
    res.json({ message: 'Chat deleted successfully' });
  } catch (error) {
    console.error('Delete chat error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Search messages in chat
router.get('/:id/search', auth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const chat = await Chat.findById(req.params.id);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Check if user is participant
    if (!chat.participants.includes(req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const searchResults = chat.messages.filter(message => 
      message.messageType === 'text' && 
      message.content.toLowerCase().includes(q.toLowerCase())
    );

    await Chat.populate(searchResults, {
      path: 'sender',
      select: 'name profilePicture'
    });

    res.json(searchResults);
  } catch (error) {
    console.error('Search messages error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;