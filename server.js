import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5050;
const AI_API_URL = process.env.AI_API_URL;
const AI_MODEL = process.env.AI_MODEL;
const BUSINESS_API_URL = 'https://hackmtyapiwebapp.onrender.com';

app.use(cors());
app.use(express.json());

// Store conversation history (user/assistant pairs only)
let conversationHistory = [];

// Business interview questions
const businessQuestions = [
  "¿Qué productos vendiste hoy?",
  "¿Cuánto producto recibiste hoy?",
  "¿Cuál es tu conteo de inventario actual?",
  "¿Pagaste a tus empleados hoy?",
  "¿Pagaste algún servicio comercial local hoy?"
];

let currentQuestionIndex = 0;
let currentQuestion = businessQuestions[0];
let questionsAnswered = new Map(); // Track which questions have been properly answered
let answers = new Array(businessQuestions.length).fill(null); // store user answers per question

/**
 * Call the AI API with valid alternating messages
 */
async function callAI(userMessage) {
  try {
    // Always include system message once
    const messages = [
      {
        role: "system",
        content: "Eres un asistente empresarial útil que realiza una entrevista. Mantén las respuestas concisas y profesionales."
      },
      ...conversationHistory,
      {
        role: "user",
        content: userMessage
      }
    ];

    const payload = {
      model: AI_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: -1,
      stream: false
    };

    console.log('🤖 Calling AI API...');
    console.log(JSON.stringify(messages, null, 2));

    const response = await axios.post(AI_API_URL, payload);
    const aiResponse = response.data.choices[0].message.content;

    console.log('✅ AI Response:', aiResponse);

    // Append new conversation pair
    conversationHistory.push(
      { role: "user", content: userMessage },
      { role: "assistant", content: aiResponse }
    );

    return aiResponse;

  } catch (error) {
    console.error('❌ AI API Error:', error.message);
    console.error(error.response?.data);
    throw error;
  }
}

/**
 * Validate if the user's answer properly addresses the current question
 * Returns { isAnswered: boolean, followUpQuestion: string }
 */
async function validateAnswer(userMessage, questionIndex) {
  try {
    const question = businessQuestions[questionIndex];
    
    const validationPrompt = `Eres un experto en validar respuestas de entrevistas.
    
Pregunta actual: "${question}"

Respuesta del usuario: "${userMessage}"

Evalúa si la respuesta del usuario contesta correctamente la pregunta. Ten en cuenta:
- ¿Proporciona información relevante sobre el tema?
- ¿Es clara y suficientemente específica?
- ¿Responde a lo solicitado?

Responde SOLO en formato JSON válido (sin texto adicional):
{
  "isAnswered": true o false,
  "confidence": 0.0 a 1.0,
  "reason": "breve explicación"
}`;

    const payload = {
      model: AI_MODEL,
      messages: [
        {
          role: "system",
          content: "Eres un experto en validación de preguntas. Responde SOLO en formato JSON válido."
        },
        {
          role: "user",
          content: validationPrompt
        }
      ],
      temperature: 0.3,
      max_tokens: -1
    };

    const response = await axios.post(AI_API_URL, payload);
    let responseText = response.data.choices[0].message.content;
    
    // Try to parse JSON response
    try {
      // Extract JSON if there's extra text
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        responseText = jsonMatch[0];
      }
      const validation = JSON.parse(responseText);
      console.log('✅ Validation result:', validation);
      return validation;
    } catch (parseError) {
      console.error('⚠️ Could not parse validation response:', responseText);
      // If we can't parse, assume it needs more info
      return { isAnswered: false, confidence: 0.5, reason: "Respuesta poco clara" };
    }

  } catch (error) {
    console.error('❌ Validation API Error:', error.message);
    return { isAnswered: false, confidence: 0, reason: "Error en validación" };
  }
}

/**
 * Generate a follow-up question to clarify the user's answer
 */
async function generateFollowUpQuestion(userMessage, questionIndex) {
  try {
    const question = businessQuestions[questionIndex];
    const followUpPrompt = `Eres un asistente que genera preguntas de seguimiento claras y naturales en español.

Pregunta actual: "${question}"

Respuesta del usuario (incompleta o confusa): "${userMessage}"

Genera UNA sola pregunta de seguimiento en español, corta y directa, que solicite la información necesaria para clarificar la respuesta. No avances a la siguiente pregunta.`;

    const payload = {
      model: AI_MODEL,
      messages: [
        {
          role: "system",
          content: "Eres un asistente de entrevista que genera preguntas de seguimiento claras y naturales."
        },
        {
          role: "user",
          content: followUpPrompt
        }
      ],
      temperature: 0.6,
      max_tokens: -1
    };

    const response = await axios.post(AI_API_URL, payload);
    const followUpQuestion = response.data.choices[0].message.content.trim();
    
    console.log('❓ Follow-up question generated:', followUpQuestion);
    return followUpQuestion;

  } catch (error) {
    console.error('❌ Follow-up generation error:', error.message);
    return `Por favor, puedes proporcionar más detalles sobre tu respuesta anterior?`;
  }
}

/**
 * Fetch products from business API
 */
async function fetchProducts() {
  try {
    const response = await axios.get(`${BUSINESS_API_URL}/api/productos`);
    console.log('📦 Raw products response:', JSON.stringify(response.data).substring(0, 200));
    
    // Handle different response structures
    let products = response.data;
    
    // If response has a data property, use that
    if (products && products.data && Array.isArray(products.data)) {
      products = products.data;
    }
    
    // Ensure we return an array
    if (!Array.isArray(products)) {
      console.error('⚠️ Products response is not an array:', typeof products);
      return [];
    }
    
    console.log(`✅ Fetched ${products.length} products`);
    return products;
  } catch (error) {
    console.error('❌ Error fetching products:', error.message);
    return [];
  }
}

/**
 * Extract product sales information from user's answer using AI
 */
async function extractSalesInfo(userAnswer, products) {
  try {
    // Ensure products is an array
    if (!Array.isArray(products) || products.length === 0) {
      console.error('⚠️ Invalid products array:', products);
      return [];
    }
    
    const productsInfo = products.map(p => `ID: ${p.id_producto}, Nombre: ${p.nombre}, Precio Venta: ${p.precio_venta}`).join('\n');
    
    const extractionPrompt = `Extrae la información de ventas del siguiente texto del usuario.

Productos disponibles:
${productsInfo}

Respuesta del usuario: "${userAnswer}"

Identifica qué productos mencionó el usuario y en qué cantidades. Responde SOLO en formato JSON válido:
{
  "productos": [
    {
      "id_producto": número,
      "nombre": "nombre del producto",
      "cantidad": número,
      "precio_unitario": número (del catálogo),
      "subtotal": número (cantidad * precio_unitario)
    }
  ]
}

Si no se mencionan cantidades específicas, asume 1 unidad.`;

    const payload = {
      model: AI_MODEL,
      messages: [
        {
          role: "system",
          content: "Eres un experto en extraer información estructurada de texto. Responde SOLO en formato JSON válido."
        },
        {
          role: "user",
          content: extractionPrompt
        }
      ],
      temperature: 0.3,
      max_tokens: -1
    };

    const response = await axios.post(AI_API_URL, payload);
    let responseText = response.data.choices[0].message.content;
    
    // Extract JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      responseText = jsonMatch[0];
    }
    
    const extracted = JSON.parse(responseText);
    console.log('✅ Extracted sales info:', extracted);
    return extracted.productos || [];
  } catch (error) {
    console.error('❌ Error extracting sales info:', error.message);
    return [];
  }
}

/**
 * Post sale to business API
 */
async function postSale(detalles) {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const total = detalles.reduce((sum, item) => sum + item.subtotal, 0);
    
    const saleData = {
      id_empleado: 1,
      fecha: today,
      total: total,
      detalles: detalles
    };
    
    console.log('📤 Posting sale:', JSON.stringify(saleData, null, 2));
    const response = await axios.post(`${BUSINESS_API_URL}/api/ventas`, saleData);
    console.log('✅ Sale posted successfully:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Error posting sale:', error.message);
    return false;
  }
}

/**
 * Post purchase (compra) to business API
 */
async function postPurchase(detalles) {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Transform detalles to match compras format
    const compraDetalles = detalles.map(item => ({
      id_producto: item.id_producto,
      cantidad_paquetes: 1, // Dummy value
      cantidad_total_producto: item.cantidad,
      costo_unitario: item.precio_unitario,
      subtotal: item.subtotal,
      descripcion: item.nombre || 'Producto recibido'
    }));
    
    const total = compraDetalles.reduce((sum, item) => sum + item.subtotal, 0);
    
    const purchaseData = {
      id_proveedor: 1, // Dummy value
      id_orden: 1, // Dummy value
      fecha: today,
      total: total,
      detalles: compraDetalles
    };
    
    console.log('📤 Posting purchase:', JSON.stringify(purchaseData, null, 2));
    const response = await axios.post(`${BUSINESS_API_URL}/api/compras`, purchaseData);
    console.log('✅ Purchase posted successfully:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Error posting purchase:', error.message);
    return false;
  }
}

/**
 * Check inventory discrepancies using AI
 */
async function checkInventory(userAnswer, products) {
  try {
    // Ensure products is an array
    if (!Array.isArray(products) || products.length === 0) {
      console.error('⚠️ Invalid products array for inventory check');
      return 'He notado tu conteo de inventario. Continuemos.';
    }
    
    const productsInfo = products.map(p => `${p.nombre}: Stock actual ${p.stock} ${p.unidad_medida}`).join('\n');
    
    const checkPrompt = `El usuario mencionó su conteo de inventario. Compara con el stock actual del sistema.

Stock actual en sistema:
${productsInfo}

Respuesta del usuario: "${userAnswer}"

Genera un mensaje breve en español informando sobre las diferencias encontradas o confirmando que coincide. Sé conciso y profesional.`;

    const payload = {
      model: AI_MODEL,
      messages: [
        {
          role: "system",
          content: "Eres un asistente que compara inventarios y genera mensajes claros sobre diferencias."
        },
        {
          role: "user",
          content: checkPrompt
        }
      ],
      temperature: 0.5,
      max_tokens: -1
    };

    const response = await axios.post(AI_API_URL, payload);
    const message = response.data.choices[0].message.content.trim();
    console.log('✅ Inventory check message:', message);
    return message;
  } catch (error) {
    console.error('❌ Error checking inventory:', error.message);
    return 'He notado tu conteo de inventario. Continuemos.';
  }
}

/**
 * Perform smart actions based on question index
 */
async function performSmartAction(questionIndex, userAnswer) {
  try {
    switch (questionIndex) {
      case 0: {
        // Question 1: Products sold
        console.log('🤖 Smart Action: Processing products sold...');
        const products = await fetchProducts();
        if (products.length === 0) {
          console.log('⚠️ No products available from API');
          return;
        }
        
        const salesInfo = await extractSalesInfo(userAnswer, products);
        if (salesInfo.length > 0) {
          await postSale(salesInfo);
        }
        break;
      }
      
      case 1: {
        // Question 2: Products received
        console.log('🤖 Smart Action: Processing products received...');
        const products = await fetchProducts();
        if (products.length === 0) {
          console.log('⚠️ No products available from API');
          return;
        }
        
        const purchaseInfo = await extractSalesInfo(userAnswer, products);
        if (purchaseInfo.length > 0) {
          await postPurchase(purchaseInfo);
        }
        break;
      }
      
      case 2: {
        // Question 3: Inventory count
        console.log('🤖 Smart Action: Checking inventory...');
        const products = await fetchProducts();
        if (products.length === 0) {
          console.log('⚠️ No products available from API');
          return null;
        }
        
        const inventoryMessage = await checkInventory(userAnswer, products);
        return inventoryMessage;
      }
      
      case 3:
      case 4: {
        // Questions 4-5: No actions
        console.log('ℹ️ No smart action for this question');
        break;
      }
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error in smart action:', error.message);
    return null;
  }
}

/**
 * Summarize the conversation into business insights
 */
async function summarizeConversation() {
  const summaryPrompt = `Resume la siguiente entrevista comercial en puntos sobre:
- Productos vendidos
- Inventario actual
- Producto recibido
- Pagos a empleados
- Pagos de servicios comerciales locales

Conversación:
${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Proporciona un resumen conciso con información procesable.`;

  const payload = {
    model: AI_MODEL,
    messages: [
      {
        role: "system",
        content: "Eres una IA de análisis comercial. Resume datos comerciales en información clave."
      },
      {
        role: "user",
        content: summaryPrompt
      }
    ],
    temperature: 0.4,
    max_tokens: -1
  };

  const response = await axios.post(AI_API_URL, payload);
  return response.data.choices[0].message.content;
}

/**
 * Start a new interview
 */
app.get('/api/start-interview', (req, res) => {
  conversationHistory = [];
  currentQuestionIndex = 0;
  currentQuestion = businessQuestions[0];
  questionsAnswered.clear();

  const introMessage = `¡Hola! Estoy aquí para ayudarte a rastrear la actividad comercial de hoy. Comencemos.`;
  const firstQuestion = businessQuestions[0];

  res.json({
    message: introMessage,
    question: firstQuestion,
    questionIndex: 0,
    totalQuestions: businessQuestions.length
  });
});

/**
 * Process user input and ask next question
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    console.log(`\n📨 User response to question ${currentQuestionIndex}: "${message}"`);

    // Store the user's answer for the current question (single source of truth)
    answers[currentQuestionIndex] = message;
    // Also append the user message to conversation history for context
    conversationHistory.push({ role: 'user', content: message });

    // Validate if the question was properly answered
    const validation = await validateAnswer(message, currentQuestionIndex);
    console.log(`\n🔍 Validation: isAnswered=${validation.isAnswered}, confidence=${validation.confidence}`);

    let nextQuestion = null;
    let requiresFollowUp = false;
    let isNewQuestion = false;
    let chatbotMessage = null;

    if (validation.isAnswered && validation.confidence > 0.6) {
      // Mark answer stored
      questionsAnswered.set(currentQuestionIndex, true);
      
      // PERFORM SMART ACTIONS based on current question
      const smartActionResult = await performSmartAction(currentQuestionIndex, message);
      
      // Deterministic acknowledgement (avoid letting LLM ask new/main questions)
      // Use smart action result if available (for inventory check), otherwise default ack
      if (smartActionResult) {
        chatbotMessage = smartActionResult;
      } else {
        chatbotMessage = '¡Excelente, entendido! Continuemos.';
      }
      
      // Append assistant ack to conversation history
      conversationHistory.push({ role: 'assistant', content: chatbotMessage });

      // Move to next predefined question
      if (currentQuestionIndex < businessQuestions.length - 1) {
        currentQuestionIndex++;
        currentQuestion = businessQuestions[currentQuestionIndex];
        nextQuestion = currentQuestion;
        isNewQuestion = true;
        console.log('✅ Answer accepted, advancing to question', currentQuestionIndex);
      } else {
        // Interview complete
        nextQuestion = null;
        isNewQuestion = true;
        console.log('🎉 All questions answered! Interview complete.');
      }
    } else {
      // Generate follow-up question for clarification
      console.log('⚠️ Answer unclear, generating follow-up question');
      requiresFollowUp = true;
      let followUp = await generateFollowUpQuestion(message, currentQuestionIndex);
      // Clean up follow-up: ensure it's a single short question and doesn't contain multiple sentences
      if (typeof followUp === 'string') {
        followUp = followUp.trim();
        // If it contains a question mark, take text up to the first question mark
        const qmIndex = followUp.indexOf('?');
        if (qmIndex !== -1) {
          followUp = followUp.slice(0, qmIndex + 1).trim();
        }
        // If the follow-up doesn't end with a question mark, fallback to a safe clarifying question
        if (!followUp.endsWith('?')) {
          followUp = '¿Puedes dar más detalles sobre tu respuesta anterior?';
        }
      } else {
        followUp = '¿Puedes dar más detalles sobre tu respuesta anterior?';
      }
      chatbotMessage = followUp;
      // Append assistant follow-up to history so future validations see it
      conversationHistory.push({ role: 'assistant', content: chatbotMessage });
      // Keep showing the original main question (do not change it)
      nextQuestion = currentQuestion;
      isNewQuestion = false;
    }

    res.json({
      response: chatbotMessage,
      nextQuestion,
      questionIndex: currentQuestionIndex,
      totalQuestions: businessQuestions.length,
      requiresFollowUp,
      isNewQuestion,
      validation: {
        isAnswered: validation.isAnswered,
        confidence: validation.confidence,
        reason: validation.reason
      }
    });
  } catch (error) {
    console.error('❌ Chat error:', error);
    res.status(500).json({ error: "Failed to process message" });
  }
});

/**
 * Summarize interview
 */
app.post('/api/summarize', async (req, res) => {
  try {
    if (conversationHistory.length === 0) {
      return res.status(400).json({ error: "No conversation to summarize" });
    }

    const summary = await summarizeConversation();

    console.log('\n========== BUSINESS SUMMARY ==========');
    console.log(summary);
    console.log('======================================\n');

    res.json({ summary });
  } catch (error) {
    res.status(500).json({ error: "Failed to summarize conversation" });
  }
});

/**
 * Get inventory recommendations based on stock projections
 */
app.get('/api/inventory-recommendations', async (req, res) => {
  try {
    console.log('📊 Fetching stock projections...');
    
    // Fetch stock projection data from business API
    const response = await axios.get(`${BUSINESS_API_URL}/api/productos/stock-proyeccion`);
    const stockData = response.data;
    
    console.log('✅ Stock projection data received');
    
    // Validate response structure
    if (!stockData.success || !stockData.data || !stockData.data.productos) {
      return res.status(500).json({ error: "Invalid stock projection data structure" });
    }
    
    const productos = stockData.data.productos;
    
    if (productos.length === 0) {
      return res.json({ 
        recommendations: [],
        message: "No hay productos para analizar"
      });
    }
    
    // Prepare data for LLM analysis
    const productosInfo = productos.map(p => 
      `Producto: ${p.producto}
- Stock actual: ${p.stock_actual}
- Ventas última semana: ${p.ventas_ultima_semana}
- Compras última semana: ${p.compras_ultima_semana}
- Stock proyectado: ${p.stock_proyectado}
- Promedio ventas diario: ${p.promedio_ventas_diario}
- Promedio compras diario: ${p.promedio_compras_diario}`
    ).join('\n\n');
    
    const analysisPrompt = `Eres un experto en gestión de inventarios. Analiza los siguientes productos y genera recomendaciones de compra para la próxima semana.

DATOS DE INVENTARIO:
${productosInfo}

INSTRUCCIONES:
Para cada producto, analiza:
1. La tendencia de ventas vs compras
2. El stock actual vs proyectado
3. Si el stock proyectado será suficiente para la próxima semana

Genera recomendaciones siguiendo EXACTAMENTE este formato JSON (sin texto adicional):
{
  "recomendaciones": [
    {
      "producto_nombre": "nombre del producto",
      "orden_actual": número (compras de la última semana del producto),
      "cambio_de_compra": 1, 2 o 3 (1=comprar menos, 2=mantener compras, 3=comprar más),
      "compra_sugerida": número entero de unidades a comprar para la próxima semana,
      "justificacion": "explicación breve y clara de la recomendación"
    }
  ]
}

IMPORTANTE: 
- El campo "orden_actual" DEBE ser el valor exacto de "Compras última semana" del producto.
- El campo "compra_sugerida" es tu recomendación para la próxima semana.

CRITERIOS:
- cambio_de_compra = 1 (comprar menos): Si el stock proyectado es alto y las ventas son bajas
- cambio_de_compra = 2 (mantener): Si el balance entre ventas y stock es estable
- cambio_de_compra = 3 (comprar más): Si el stock proyectado es bajo o las ventas superan las compras

La compra_sugerida debe ser un número realista basado en el promedio de ventas diario multiplicado por 7 días, ajustado según el stock actual.`;

    const payload = {
      model: AI_MODEL,
      messages: [
        {
          role: "system",
          content: "Eres un experto en análisis de inventarios y gestión de compras. Generas recomendaciones precisas basadas en datos. Responde SOLO en formato JSON válido."
        },
        {
          role: "user",
          content: analysisPrompt
        }
      ],
      temperature: 0.3,
      max_tokens: -1
    };

    console.log('🤖 Analyzing inventory with AI...');
    const aiResponse = await axios.post(AI_API_URL, payload);
    let responseText = aiResponse.data.choices[0].message.content;
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      responseText = jsonMatch[0];
    }
    
    const analysis = JSON.parse(responseText);
    
    console.log('✅ AI recommendations generated:', analysis);
    
    res.json({
      success: true,
      periodo: stockData.data.periodo,
      recommendations: analysis.recomendaciones || [],
      raw_data: productos
    });
    
  } catch (error) {
    console.error('❌ Error generating inventory recommendations:', error.message);
    res.status(500).json({ 
      error: "Failed to generate inventory recommendations",
      details: error.message 
    });
  }
});

/**
 * Utilities
 */
app.get('/api/conversation-history', (req, res) => {
  res.json({ history: conversationHistory });
});

app.post('/api/reset', (req, res) => {
  conversationHistory = [];
  currentQuestionIndex = 0;
  currentQuestion = businessQuestions[0];
  questionsAnswered.clear();
  answers = new Array(businessQuestions.length).fill(null);
  res.json({ message: "Conversation reset" });
});

app.get('/api/health', (req, res) => {
  res.json({ status: "ok", aiApiUrl: AI_API_URL, model: AI_MODEL });
});

app.listen(PORT,'0.0.0.0', () => {
  console.log(`✓ Backend server running: http://10.22.200.227:${PORT}`);
  console.log(`✓ AI API: ${AI_API_URL}`);
  console.log(`✓ Model: ${AI_MODEL}`);
});
