export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const authToken = process.env.RELEVANCE_AUTH_TOKEN; // formato: "project_id:api_key"
  const agentId = process.env.RELEVANCE_AGENT_ID;
  const region = process.env.RELEVANCE_REGION; // ej: "f1db6c" (lo ves en tu URL de API Keys)

  if (!authToken || !agentId || !region) {
    return res.status(500).json({ error: 'Configuración de Relevance AI incompleta' });
  }

  const { mensaje, conversation_id } = req.body;

  if (!mensaje) {
    return res.status(400).json({ error: 'Falta el mensaje' });
  }

  const payload = {
    message: { role: 'user', content: mensaje },
    agent_id: agentId,
  };

  // Si ya hay una conversación en curso, la continuamos en el mismo hilo
  if (conversation_id) {
    payload.conversation_id = conversation_id;
  }

  try {
    const response = await fetch(
      `https://api-${region}.stack.tryrelevance.com/latest/agents/trigger`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authToken,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      throw new Error(`Relevance AI respondió con estado ${response.status}`);
    }

    const data = await response.json();

    return res.status(200).json({
      respuesta: data.message?.content || 'No he podido procesar tu mensaje, inténtalo de nuevo.',
      conversation_id: data.conversation_id || conversation_id || null,
    });
  } catch (error) {
    console.error('Error llamando a Relevance AI:', error);
    return res.status(500).json({ error: 'Error al contactar con el asistente' });
  }
}