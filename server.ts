import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

interface FirebaseConfig {
  projectId: string;
  apiKey: string;
  firestoreDatabaseId?: string;
}

interface VerifiedUser {
  uid: string;
  email: string;
  emailVerified: boolean;
}

const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig: FirebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const PRIMARY_ADMIN_EMAIL = 'malejacalcas@gmail.com';
const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function getAllowedAdminEmails(): Set<string> {
  const raw = process.env.ALLOWED_ADMIN_EMAILS || PRIMARY_ADMIN_EMAIL;
  const set = new Set<string>([PRIMARY_ADMIN_EMAIL]);
  for (const entry of raw.split(',')) {
    const clean = entry.trim().toLowerCase();
    if (clean) set.add(clean);
  }
  return set;
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function checkFirestoreAuthorizedUser(uid: string, idToken: string): Promise<boolean> {
  if (!firebaseConfig.projectId) return false;
  const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    firebaseConfig.projectId
  )}/databases/${encodeURIComponent(dbId)}/documents/authorizedUsers/${encodeURIComponent(uid)}`;

  try {
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!resp.ok) return false;
    const doc = (await resp.json()) as { fields?: { active?: { booleanValue?: boolean } } };
    return doc?.fields?.active?.booleanValue !== false;
  } catch {
    return false;
  }
}

async function verifyFirebaseUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Sesión no autorizada. Inicie sesión para continuar.' });
    return;
  }

  const idToken = authHeader.slice(7).trim();
  if (!idToken || idToken.length > 4096) {
    res.status(401).json({ error: 'Token de sesión inválido.' });
    return;
  }

  try {
    const lookupUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(
      firebaseConfig.apiKey
    )}`;
    const resp = await fetch(lookupUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    if (!resp.ok) {
      res.status(401).json({ error: 'Su sesión expiró o no es válida. Inicie sesión nuevamente.' });
      return;
    }

    const data = (await resp.json()) as {
      users?: Array<{ localId?: string; email?: string; emailVerified?: boolean; disabled?: boolean }>;
    };
    const user = data.users?.[0];
    if (!user || !user.localId || !user.email || user.disabled) {
      res.status(401).json({ error: 'Usuario inválido o deshabilitado.' });
      return;
    }

    if (!user.emailVerified) {
      res.status(403).json({
        error: 'Debe verificar su correo electrónico antes de consultar el asistente financiero.',
      });
      return;
    }

    const normalizedEmail = user.email.toLowerCase();
    const allowedEmails = getAllowedAdminEmails();
    let isAuthorized = allowedEmails.has(normalizedEmail);
    if (!isAuthorized) {
      isAuthorized = await checkFirestoreAuthorizedUser(user.localId, idToken);
    }

    if (!isAuthorized) {
      res.status(403).json({
        error: 'Esta cuenta no está autorizada para acceder a Maleja Diseños.',
      });
      return;
    }

    (req as Request & { authUser?: VerifiedUser }).authUser = {
      uid: user.localId,
      email: normalizedEmail,
      emailVerified: Boolean(user.emailVerified),
    };
    next();
  } catch (err) {
    console.error('Error verifying Firebase token:', err instanceof Error ? err.message : err);
    res.status(503).json({ error: 'No se pudo validar la sesión con el servicio de autenticación.' });
  }
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'maleja-disenos-control-financiero',
      environment: IS_PRODUCTION ? 'production' : 'development',
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
    });
  });

  app.post('/api/ai/chat', verifyFirebaseUser, async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'El Asistente IA no está configurado todavía. Defina GEMINI_API_KEY en las variables de entorno del servidor (Render / Secrets).',
      });
      return;
    }

    const { prompt, systemContext } = (req.body || {}) as {
      prompt?: unknown;
      systemContext?: unknown;
    };

    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 4000) {
      res.status(400).json({ error: 'La consulta debe ser un texto válido (máximo 4.000 caracteres).' });
      return;
    }

    const safeContext = typeof systemContext === 'string' ? systemContext.slice(0, 32000) : '';

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `${safeContext}\n\nPregunta o instrucción del usuario: "${prompt.trim()}"`,
      });
      res.json({ text: response.text || 'No se pudo procesar tu solicitud.' });
    } catch (err) {
      console.error('Gemini /api/ai/chat error:', err instanceof Error ? err.message : err);
      res.status(502).json({
        error: 'No fue posible obtener respuesta del servicio de inteligencia artificial en este momento.',
      });
    }
  });

  app.post('/api/ai/analyze', verifyFirebaseUser, async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'El Asesor IA no está configurado todavía. Defina GEMINI_API_KEY en las variables de entorno del servidor.',
      });
      return;
    }

    const { summaryPrompt } = (req.body || {}) as { summaryPrompt?: unknown };
    if (typeof summaryPrompt !== 'string' || !summaryPrompt.trim() || summaryPrompt.length > 16000) {
      res.status(400).json({ error: 'Resumen financiero inválido.' });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: summaryPrompt.trim(),
      });
      res.json({ text: response.text || 'No se pudo generar el diagnóstico en este momento.' });
    } catch (err) {
      console.error('Gemini /api/ai/analyze error:', err instanceof Error ? err.message : err);
      res.status(502).json({
        error: 'Error al consultar el servicio de diagnóstico IA.',
      });
    }
  });

  app.use('/api/*', (_req, res) => {
    res.status(404).json({ error: 'Ruta de API no encontrada.' });
  });

  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    const indexHtml = path.join(distDir, 'index.html');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(indexHtml);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Maleja Diseños server running on http://0.0.0.0:${PORT} (${IS_PRODUCTION ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
