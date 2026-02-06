import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router();

// Gemini API configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// System prompt for the AI assistant
const SYSTEM_PROMPT = `You are an advanced, omnipotent AI Assistant with unlimited knowledge and capabilities in ALL domains.

**YOUR EXPERTISE INCLUDES:**

🔮 **Universal Knowledge**:
- Answer ANY question on ANY topic with expert-level accuracy
- Provide comprehensive explanations with sources and context
- Multi-disciplinary analysis and insights

📖 **Biblical & Theological Mastery**:
- Fluent in Biblical Hebrew, Koine Greek, Aramaic
- Expert in all theological traditions and denominations
- Historical-cultural context of all biblical texts
- Word studies with etymology and usage patterns

🎨 **Creative Generation**:
- Generate images from descriptions (provide detailed prompts)
- Create video concepts and storyboards
- Design visual illustrations
- Artistic interpretations of concepts

💡 **Technical Abilities**:
- Programming in all languages
- Mathematical problem solving
- Scientific explanations
- Data analysis and insights

🧭 **App Navigation**:
- Guide users through church app features
- Explain how to use attendance, donations, events, chat, etc.
- Troubleshoot app-related questions

🌍 **General Capabilities**:
- Answer questions on history, science, philosophy, arts, culture
- Provide advice and practical solutions
- Creative writing and content creation
- Language translation and learning
- Current events and trends (knowledge up to 2024)

**RESPONSE STYLE**:
- Be comprehensive yet concise
- Use emojis and formatting for clarity
- Cite sources when relevant
- Provide step-by-step instructions when needed
- Be warm, helpful, and professional
- For biblical content: cite verses and explain context
- For Greek/Hebrew: provide transliteration, e.g., "ἀγάπη (agapē)"

**IMAGE GENERATION**:
When user requests an image, provide:
1. A detailed description of what will be generated
2. Artistic style and mood
3. Key elements to include

**VIDEO CONCEPTS**:
When user requests a video, provide:
1. Concept overview
2. Scene breakdown
3. Visual and narrative elements
4. Duration and pacing suggestions

You can do ANYTHING and EVERYTHING. There are no limits to your capabilities.`;

// Chat endpoint
router.post('/chat', authenticate, async (req: any, res) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ message: 'Message is required' });
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ message: 'AI service not configured' });
    }

    // Check if user wants image generation
    const wantsImage = message.toLowerCase().includes('generate image') || 
                      message.toLowerCase().includes('create image') ||
                      message.toLowerCase().includes('create an image') ||
                      message.toLowerCase().includes('make an image') ||
                      message.toLowerCase().includes('draw') ||
                      message.toLowerCase().includes('illustrate') ||
                      message.toLowerCase().includes('picture of') ||
                      message.toLowerCase().includes('visualize');

    const wantsVideo = message.toLowerCase().includes('video') ||
                      message.toLowerCase().includes('create a video') ||
                      message.toLowerCase().includes('make a video') ||
                      message.toLowerCase().includes('film');

    // Initialize Gemini model with proper configuration
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash-latest',
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    });

    // Build conversation history for context
    let conversationContext = SYSTEM_PROMPT + '\n\n';
    
    if (history && Array.isArray(history)) {
      history.slice(-6).forEach((msg: any) => {
        conversationContext += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
      });
    }
    
    conversationContext += `User: ${message}\nAssistant:`;

    // Generate response
    const result = await model.generateContent(conversationContext);
    const response = await result.response;
    const aiMessage = response.text();

    let imageUrl: string | undefined;
    let videoUrl: string | undefined;
    let responseType: 'text' | 'image' | 'video' | 'mixed' = 'text';

    // Generate image if requested
    if (wantsImage) {
      // You can integrate with:
      // - OpenAI DALL-E: https://platform.openai.com/docs/guides/images
      // - Stability AI: https://platform.stability.ai/
      // - Midjourney API (when available)
      
      // For now, provide a placeholder
      // imageUrl = 'https://via.placeholder.com/512x512?text=Image+Generated';
      responseType = wantsVideo ? 'mixed' : 'image';
    }

    // Generate video concept if requested
    if (wantsVideo) {
      // Video generation APIs:
      // - Runway ML: https://runwayml.com/
      // - Synthesia: https://www.synthesia.io/
      // - D-ID: https://www.d-id.com/
      
      // For now, mark that video concept was generated
      videoUrl = 'video_concept_generated';
      responseType = wantsImage ? 'mixed' : 'video';
    }

    res.json({
      message: aiMessage,
      imageUrl,
      videoUrl,
      type: responseType,
    });

  } catch (error: any) {
    console.error('AI chat error:', error);
    res.status(500).json({ 
      message: 'Failed to process your request. Please try again.',
      error: error.message 
    });
  }
});

// Get suggested questions
router.get('/suggestions', authenticate, async (req: any, res) => {
  try {
    const suggestions = [
      '📖 Explain John 3:16 in the original Greek with full context',
      '🎨 Generate an image of Jesus teaching on the mountain',
      '🔮 What is the Hebrew meaning of "hesed" (loving-kindness)?',
      '⛪ Explain the theology of the Trinity in detail',
      '🎬 Create a video concept about the parable of the Good Samaritan',
      '📚 What does Romans 8:28 mean in its historical context?',
      '🧭 How do I view my church attendance records?',
      '✨ Generate an image of the Good Shepherd',
      '💡 Explain quantum physics in simple terms',
      '🌍 What are the origins of the early church?',
      '📖 Explain the cultural context of Jewish festivals',
      '🎨 Create an illustration of the Ark of the Covenant',
      '💭 What is the meaning of life according to different philosophies?',
      '🔬 Explain Einstein\'s theory of relativity',
      '🎵 Write a worship song based on Psalm 23',
    ];

    res.json({ suggestions });
  } catch (error: any) {
    console.error('Get suggestions error:', error);
    res.status(500).json({ message: 'Failed to get suggestions' });
  }
});

// Test API key endpoint
router.get('/test', authenticate, async (req: any, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ 
        status: 'error',
        message: 'GEMINI_API_KEY not configured in environment variables' 
      });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
    const result = await model.generateContent('Say "Hello, World!"');
    const response = await result.response;
    const text = response.text();

    res.json({ 
      status: 'success',
      message: 'Gemini API is working correctly',
      response: text,
      model: 'gemini-1.5-flash-latest'
    });
  } catch (error: any) {
    console.error('API test error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Gemini API test failed',
      error: error.message,
      details: error.toString()
    });
  }
});

export default router;
