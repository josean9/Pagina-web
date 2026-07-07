export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const authToken = process.env.RELEVANCE_AUTH_TOKEN;
  const agentId = process.env.RELEVANCE_AGENT_ID;
  const region = process.env.RELEVANCE_REGION;

  if (!authToken || !agentId || !region) {
    return res.status(500).json({ error: 'Configuración de Relevance AI incompleta' });
  }

  const { mensaje, conversation_id } = req.body;

  if (!mensaje) {
    return res.status(400).json({ error: 'Falta el mensaje' });
  }

  const baseUrl = `https://api-${region}.stack.tryrelevance.com/latest`;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: authToken,
  };

  const payload = {
    message: { role: 'user', content: mensaje },
    agent_id: agentId,
  };
  if (conversation_id) payload.conversation_id = conversation_id;

  try {
    const triggerResponse = await fetch(`${baseUrl}/agents/trigger`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!triggerResponse.ok) {
      throw new Error(`Relevance AI respondió con estado ${triggerResponse.status}`);
    }

    const triggerData = await triggerResponse.json();
    const studioId = triggerData.job_info?.studio_id;
    const jobId = triggerData.job_info?.job_id;
    const newConversationId = triggerData.conversation_id || conversation_id;

    if (!studioId || !jobId) {
      throw new Error('Respuesta de trigger sin studio_id/job_id: ' + JSON.stringify(triggerData));
    }

    const pollUrl = `${baseUrl}/studios/${studioId}/async_poll/${jobId}`;
    let respuestaTexto = null;

    for (let intento = 0; intento < 20; intento++) {
      await new Promise((r) => setTimeout(r, 1000));

      const pollResponse = await fetch(pollUrl, { headers });
      if (!pollResponse.ok) continue;

      const pollData = await pollResponse.json();

      // LOG TEMPORAL DE DEPURACIÓN — quitar una vez confirmemos la estructura
      console.log('POLL DATA COMPLETO:', JSON.stringify(pollData, null, 2));

      if (pollData.type === 'complete') {
        const updates = pollData.updates || [];
        const chainSuccess = [...updates]
          .reverse()
          .find((u) => u.type === 'chain-success' && u.output?.output?.answer);

        respuestaTexto =
          chainSuccess?.output?.output?.answer ||
          'Gracias por tu mensaje, nuestro equipo lo revisará.';
        break;
      }

      if (pollData.type === 'failed') {
        throw new Error('El agente falló al procesar el mensaje: ' + JSON.stringify(pollData));
      }
    }

    if (!respuestaTexto) {
      respuestaTexto = 'Estamos procesando tu consulta, dame un momento más o inténtalo de nuevo.';
    }

    return res.status(200).json({
      respuesta: respuestaTexto,
      conversation_id: newConversationId,
    });
  } catch (error) {
    console.error('Error llamando a Relevance AI:', error);
    return res.status(500).json({ error: 'Error al contactar con el asistente' });
  }
}