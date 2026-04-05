const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ── 라우터 등록 ──
app.use('/api/d2', require('./routes/d2'));
app.use('/api/d14', require('./routes/d14'));

// ── 헬스체크 ──
app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`DRED API running on port ${PORT}`));
