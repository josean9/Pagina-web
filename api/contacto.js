export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const webhookUrl = process.env.RELEVANCE_WEBHOOK_URL;

  if (!webhookUrl) {
    return res.status(500).json({ error: 'Webhook no configurado' });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      throw new Error(`Webhook respondió con estado ${response.status}`);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error enviando al webhook:', error);
    return res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
}