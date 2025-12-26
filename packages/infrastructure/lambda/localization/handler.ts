import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { localizationService } from '../shared/services';
import { extractAuthContext } from '../shared/auth';
import { success, handleError } from '../shared/response';
import { ValidationError } from '../shared/errors';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const path = event.path;
    const method = event.httpMethod;

    // GET /localization/languages - Get supported languages (public)
    if (method === 'GET' && path.endsWith('/languages')) {
      const languages = await localizationService.getSupportedLanguages();
      return success({ languages });
    }

    // GET /localization/bundle - Get translation bundle (public)
    if (method === 'GET' && path.endsWith('/bundle')) {
      const languageCode = event.queryStringParameters?.language || 'en';
      const category = event.queryStringParameters?.category;
      const appId = event.queryStringParameters?.appId;

      const bundle = await localizationService.getTranslationBundle(languageCode, category, appId);
      return success({ bundle, language: languageCode });
    }

    // GET /localization/translate - Get single translation (public)
    if (method === 'GET' && path.endsWith('/translate')) {
      const key = event.queryStringParameters?.key;
      const languageCode = event.queryStringParameters?.language || 'en';

      if (!key) {
        throw new ValidationError('key is required');
      }

      const text = await localizationService.getTranslation(key, languageCode);
      return success({ key, text, language: languageCode });
    }

    // Admin-only routes below
    const user = extractAuthContext(event);

    // POST /localization/register - Register new string
    if (method === 'POST' && path.endsWith('/register')) {
      const body = JSON.parse(event.body || '{}');
      
      if (!body.key || !body.defaultText || !body.category) {
        throw new ValidationError('key, defaultText, and category are required');
      }

      const id = await localizationService.registerString({
        key: body.key,
        defaultText: body.defaultText,
        context: body.context,
        category: body.category,
        placeholders: body.placeholders,
      });

      return success({ id, key: body.key });
    }

    // POST /localization/translation - Set translation
    if (method === 'POST' && path.endsWith('/translation')) {
      const body = JSON.parse(event.body || '{}');
      
      if (!body.key || !body.languageCode || !body.translatedText) {
        throw new ValidationError('key, languageCode, and translatedText are required');
      }

      await localizationService.setTranslation(
        body.key,
        body.languageCode,
        body.translatedText,
        body.status || 'pending',
        'human'
      );

      return success({ updated: true });
    }

    // POST /localization/approve - Approve translation
    if (method === 'POST' && path.endsWith('/approve')) {
      const body = JSON.parse(event.body || '{}');
      
      if (!body.key || !body.languageCode) {
        throw new ValidationError('key and languageCode are required');
      }

      await localizationService.approveTranslation(body.key, body.languageCode, user.userId);
      return success({ approved: true });
    }

    // POST /localization/translate-ai - Translate with AI
    if (method === 'POST' && path.endsWith('/translate-ai')) {
      const body = JSON.parse(event.body || '{}');
      
      if (!body.key || !body.targetLanguages?.length) {
        throw new ValidationError('key and targetLanguages are required');
      }

      await localizationService.translateWithAI(body.key, body.targetLanguages);
      return success({ queued: true });
    }

    // GET /localization/stats - Get translation statistics
    if (method === 'GET' && path.endsWith('/stats')) {
      const stats = await localizationService.getTranslationStats();
      return success(stats);
    }

    throw new ValidationError(`Unknown route: ${method} ${path}`);
  } catch (error) {
    return handleError(error);
  }
}
