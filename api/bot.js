const BOT_TOKEN = process.env.BOT_TOKEN || '';
const APP_URL = process.env.APP_URL || '';

async function sendMessage(chatId, params) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, ...params })
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('ok');
  }

  const update = req.body;
  const message = update.message || update.callback_query?.message;
  const chatId = message?.chat?.id;

  if (!chatId) return res.status(200).send('ok');

  const text = message?.text || '';

  if (text === '/start' || text.startsWith('/start')) {
    await sendMessage(chatId, {
      text: `*LUMINEX* — закрытая система управления активами.\n\nНажми кнопку ниже чтобы войти в дашборд.`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{
          text: '⚡ Открыть Luminex',
          web_app: { url: APP_URL + '/login' }
        }]]
      }
    });
  }

  res.status(200).send('ok');
};
