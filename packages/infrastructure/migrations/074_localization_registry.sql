-- RADIANT v4.18.0 - Localization Registry
-- Stores all UI strings and translations for multi-language support

-- Localization registry table
CREATE TABLE IF NOT EXISTS localization_registry (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) NOT NULL UNIQUE,
    default_text TEXT NOT NULL,
    context TEXT,
    category VARCHAR(100) NOT NULL,
    placeholders TEXT[], -- Array of placeholder names like {count}, {name}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Translations table
CREATE TABLE IF NOT EXISTS localization_translations (
    id SERIAL PRIMARY KEY,
    registry_id INTEGER NOT NULL REFERENCES localization_registry(id) ON DELETE CASCADE,
    language_code VARCHAR(10) NOT NULL,
    translated_text TEXT NOT NULL,
    is_machine_translated BOOLEAN DEFAULT FALSE,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(registry_id, language_code)
);

-- User language preferences
CREATE TABLE IF NOT EXISTS user_language_preferences (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    language_code VARCHAR(10) NOT NULL DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, tenant_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_localization_registry_category ON localization_registry(category);
CREATE INDEX IF NOT EXISTS idx_localization_registry_key ON localization_registry(key);
CREATE INDEX IF NOT EXISTS idx_localization_translations_language ON localization_translations(language_code);
CREATE INDEX IF NOT EXISTS idx_user_language_preferences_user ON user_language_preferences(user_id, tenant_id);

-- Insert common UI strings
INSERT INTO localization_registry (key, default_text, context, category) VALUES
-- Common buttons
('common.buttons.save', 'Save', 'Save button label', 'buttons'),
('common.buttons.cancel', 'Cancel', 'Cancel button label', 'buttons'),
('common.buttons.delete', 'Delete', 'Delete button label', 'buttons'),
('common.buttons.edit', 'Edit', 'Edit button label', 'buttons'),
('common.buttons.create', 'Create', 'Create button label', 'buttons'),
('common.buttons.submit', 'Submit', 'Submit button label', 'buttons'),
('common.buttons.close', 'Close', 'Close button label', 'buttons'),
('common.buttons.back', 'Back', 'Back button label', 'buttons'),
('common.buttons.next', 'Next', 'Next button label', 'buttons'),
('common.buttons.refresh', 'Refresh', 'Refresh button label', 'buttons'),

-- Think Tank specific
('thinktank.settings.title', 'Think Tank Settings', 'Settings page title', 'thinktank'),
('thinktank.settings.description', 'Configure Think Tank parameters and features', 'Settings page description', 'thinktank'),
('thinktank.settings.language_title', 'Language Settings', 'Language settings card title', 'thinktank'),
('thinktank.settings.language_description', 'Choose your preferred language for Think Tank interface', 'Language settings description', 'thinktank'),
('thinktank.settings.interface_language', 'Interface Language', 'Language selector label', 'thinktank'),
('thinktank.settings.select_language', 'Select language', 'Language selector placeholder', 'thinktank'),
('thinktank.settings.available_languages', 'Available Languages', 'Available languages section title', 'thinktank'),
('thinktank.settings.translation_coverage', 'Translation Coverage', 'Translation coverage section title', 'thinktank'),

-- Think Tank features
('thinktank.features.collaboration', 'Real-time Collaboration', 'Collaboration feature name', 'thinktank'),
('thinktank.features.collaboration_desc', 'Allow users to collaborate on conversations', 'Collaboration feature description', 'thinktank'),
('thinktank.features.voice_input', 'Voice Input', 'Voice input feature name', 'thinktank'),
('thinktank.features.voice_input_desc', 'Enable voice-to-text input', 'Voice input feature description', 'thinktank'),
('thinktank.features.code_execution', 'Code Execution', 'Code execution feature name', 'thinktank'),
('thinktank.features.code_execution_desc', 'Allow AI to execute code in sandboxed environment', 'Code execution feature description', 'thinktank'),
('thinktank.features.file_uploads', 'File Uploads', 'File uploads feature name', 'thinktank'),
('thinktank.features.file_uploads_desc', 'Allow users to upload files for AI analysis', 'File uploads feature description', 'thinktank'),
('thinktank.features.image_generation', 'Image Generation', 'Image generation feature name', 'thinktank'),
('thinktank.features.image_generation_desc', 'Enable AI image generation capabilities', 'Image generation feature description', 'thinktank'),

-- Status messages
('common.status.loading', 'Loading...', 'Loading indicator text', 'status'),
('common.status.saving', 'Saving...', 'Saving indicator text', 'status'),
('common.status.saved', 'Saved', 'Saved confirmation text', 'status'),
('common.status.error', 'An error occurred', 'Generic error message', 'status'),
('common.status.success', 'Success', 'Generic success message', 'status'),

-- Navigation
('nav.dashboard', 'Dashboard', 'Dashboard navigation item', 'navigation'),
('nav.settings', 'Settings', 'Settings navigation item', 'navigation'),
('nav.users', 'Users', 'Users navigation item', 'navigation'),
('nav.conversations', 'Conversations', 'Conversations navigation item', 'navigation'),
('nav.models', 'Models', 'Models navigation item', 'navigation'),

-- Error messages
('errors.network.connection_failed', 'Connection failed. Please check your internet connection.', 'Network error message', 'errors'),
('errors.auth.session_expired', 'Your session has expired. Please sign in again.', 'Session expired error', 'errors'),
('errors.validation.required_field', 'This field is required', 'Required field validation error', 'errors'),
('errors.validation.invalid_email', 'Please enter a valid email address', 'Invalid email validation error', 'errors')

ON CONFLICT (key) DO NOTHING;

-- Insert Spanish translations
INSERT INTO localization_translations (registry_id, language_code, translated_text) 
SELECT id, 'es', CASE key
    WHEN 'common.buttons.save' THEN 'Guardar'
    WHEN 'common.buttons.cancel' THEN 'Cancelar'
    WHEN 'common.buttons.delete' THEN 'Eliminar'
    WHEN 'common.buttons.edit' THEN 'Editar'
    WHEN 'common.buttons.create' THEN 'Crear'
    WHEN 'common.buttons.submit' THEN 'Enviar'
    WHEN 'common.buttons.close' THEN 'Cerrar'
    WHEN 'common.buttons.back' THEN 'Atrás'
    WHEN 'common.buttons.next' THEN 'Siguiente'
    WHEN 'common.buttons.refresh' THEN 'Actualizar'
    WHEN 'thinktank.settings.title' THEN 'Configuración de Think Tank'
    WHEN 'thinktank.settings.description' THEN 'Configurar parámetros y funciones de Think Tank'
    WHEN 'thinktank.settings.language_title' THEN 'Configuración de Idioma'
    WHEN 'thinktank.settings.language_description' THEN 'Elige tu idioma preferido para la interfaz de Think Tank'
    WHEN 'thinktank.settings.interface_language' THEN 'Idioma de la Interfaz'
    WHEN 'thinktank.settings.select_language' THEN 'Seleccionar idioma'
    WHEN 'thinktank.settings.available_languages' THEN 'Idiomas Disponibles'
    WHEN 'thinktank.settings.translation_coverage' THEN 'Cobertura de Traducción'
    WHEN 'thinktank.features.collaboration' THEN 'Colaboración en Tiempo Real'
    WHEN 'thinktank.features.collaboration_desc' THEN 'Permitir a los usuarios colaborar en conversaciones'
    WHEN 'thinktank.features.voice_input' THEN 'Entrada de Voz'
    WHEN 'thinktank.features.voice_input_desc' THEN 'Habilitar entrada de voz a texto'
    WHEN 'thinktank.features.code_execution' THEN 'Ejecución de Código'
    WHEN 'thinktank.features.code_execution_desc' THEN 'Permitir que la IA ejecute código en un entorno aislado'
    WHEN 'thinktank.features.file_uploads' THEN 'Carga de Archivos'
    WHEN 'thinktank.features.file_uploads_desc' THEN 'Permitir a los usuarios cargar archivos para análisis de IA'
    WHEN 'thinktank.features.image_generation' THEN 'Generación de Imágenes'
    WHEN 'thinktank.features.image_generation_desc' THEN 'Habilitar capacidades de generación de imágenes con IA'
    WHEN 'common.status.loading' THEN 'Cargando...'
    WHEN 'common.status.saving' THEN 'Guardando...'
    WHEN 'common.status.saved' THEN 'Guardado'
    WHEN 'common.status.error' THEN 'Ocurrió un error'
    WHEN 'common.status.success' THEN 'Éxito'
    WHEN 'nav.dashboard' THEN 'Panel'
    WHEN 'nav.settings' THEN 'Configuración'
    WHEN 'nav.users' THEN 'Usuarios'
    WHEN 'nav.conversations' THEN 'Conversaciones'
    WHEN 'nav.models' THEN 'Modelos'
    WHEN 'errors.network.connection_failed' THEN 'Conexión fallida. Por favor, verifica tu conexión a internet.'
    WHEN 'errors.auth.session_expired' THEN 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.'
    WHEN 'errors.validation.required_field' THEN 'Este campo es obligatorio'
    WHEN 'errors.validation.invalid_email' THEN 'Por favor, ingresa un correo electrónico válido'
    ELSE default_text
END
FROM localization_registry
ON CONFLICT (registry_id, language_code) DO NOTHING;

-- Insert French translations
INSERT INTO localization_translations (registry_id, language_code, translated_text) 
SELECT id, 'fr', CASE key
    WHEN 'common.buttons.save' THEN 'Enregistrer'
    WHEN 'common.buttons.cancel' THEN 'Annuler'
    WHEN 'common.buttons.delete' THEN 'Supprimer'
    WHEN 'common.buttons.edit' THEN 'Modifier'
    WHEN 'common.buttons.create' THEN 'Créer'
    WHEN 'common.buttons.submit' THEN 'Soumettre'
    WHEN 'common.buttons.close' THEN 'Fermer'
    WHEN 'common.buttons.back' THEN 'Retour'
    WHEN 'common.buttons.next' THEN 'Suivant'
    WHEN 'common.buttons.refresh' THEN 'Actualiser'
    WHEN 'thinktank.settings.title' THEN 'Paramètres Think Tank'
    WHEN 'thinktank.settings.description' THEN 'Configurer les paramètres et fonctionnalités de Think Tank'
    WHEN 'thinktank.settings.language_title' THEN 'Paramètres de Langue'
    WHEN 'thinktank.settings.language_description' THEN 'Choisissez votre langue préférée pour l''interface Think Tank'
    WHEN 'thinktank.settings.interface_language' THEN 'Langue de l''Interface'
    WHEN 'thinktank.settings.select_language' THEN 'Sélectionner la langue'
    WHEN 'thinktank.settings.available_languages' THEN 'Langues Disponibles'
    WHEN 'thinktank.settings.translation_coverage' THEN 'Couverture de Traduction'
    WHEN 'common.status.loading' THEN 'Chargement...'
    WHEN 'common.status.saving' THEN 'Enregistrement...'
    WHEN 'common.status.saved' THEN 'Enregistré'
    WHEN 'common.status.error' THEN 'Une erreur s''est produite'
    WHEN 'common.status.success' THEN 'Succès'
    WHEN 'nav.dashboard' THEN 'Tableau de bord'
    WHEN 'nav.settings' THEN 'Paramètres'
    WHEN 'nav.users' THEN 'Utilisateurs'
    WHEN 'nav.conversations' THEN 'Conversations'
    WHEN 'nav.models' THEN 'Modèles'
    ELSE default_text
END
FROM localization_registry
ON CONFLICT (registry_id, language_code) DO NOTHING;

-- Insert German translations
INSERT INTO localization_translations (registry_id, language_code, translated_text) 
SELECT id, 'de', CASE key
    WHEN 'common.buttons.save' THEN 'Speichern'
    WHEN 'common.buttons.cancel' THEN 'Abbrechen'
    WHEN 'common.buttons.delete' THEN 'Löschen'
    WHEN 'common.buttons.edit' THEN 'Bearbeiten'
    WHEN 'common.buttons.create' THEN 'Erstellen'
    WHEN 'common.buttons.submit' THEN 'Absenden'
    WHEN 'common.buttons.close' THEN 'Schließen'
    WHEN 'common.buttons.back' THEN 'Zurück'
    WHEN 'common.buttons.next' THEN 'Weiter'
    WHEN 'common.buttons.refresh' THEN 'Aktualisieren'
    WHEN 'thinktank.settings.title' THEN 'Think Tank Einstellungen'
    WHEN 'thinktank.settings.description' THEN 'Think Tank Parameter und Funktionen konfigurieren'
    WHEN 'thinktank.settings.language_title' THEN 'Spracheinstellungen'
    WHEN 'thinktank.settings.language_description' THEN 'Wählen Sie Ihre bevorzugte Sprache für die Think Tank Oberfläche'
    WHEN 'thinktank.settings.interface_language' THEN 'Oberflächensprache'
    WHEN 'thinktank.settings.select_language' THEN 'Sprache auswählen'
    WHEN 'thinktank.settings.available_languages' THEN 'Verfügbare Sprachen'
    WHEN 'thinktank.settings.translation_coverage' THEN 'Übersetzungsabdeckung'
    WHEN 'common.status.loading' THEN 'Laden...'
    WHEN 'common.status.saving' THEN 'Speichern...'
    WHEN 'common.status.saved' THEN 'Gespeichert'
    WHEN 'common.status.error' THEN 'Ein Fehler ist aufgetreten'
    WHEN 'common.status.success' THEN 'Erfolg'
    WHEN 'nav.dashboard' THEN 'Dashboard'
    WHEN 'nav.settings' THEN 'Einstellungen'
    WHEN 'nav.users' THEN 'Benutzer'
    WHEN 'nav.conversations' THEN 'Konversationen'
    WHEN 'nav.models' THEN 'Modelle'
    ELSE default_text
END
FROM localization_registry
ON CONFLICT (registry_id, language_code) DO NOTHING;

-- Insert Japanese translations
INSERT INTO localization_translations (registry_id, language_code, translated_text) 
SELECT id, 'ja', CASE key
    WHEN 'common.buttons.save' THEN '保存'
    WHEN 'common.buttons.cancel' THEN 'キャンセル'
    WHEN 'common.buttons.delete' THEN '削除'
    WHEN 'common.buttons.edit' THEN '編集'
    WHEN 'common.buttons.create' THEN '作成'
    WHEN 'common.buttons.submit' THEN '送信'
    WHEN 'common.buttons.close' THEN '閉じる'
    WHEN 'common.buttons.back' THEN '戻る'
    WHEN 'common.buttons.next' THEN '次へ'
    WHEN 'common.buttons.refresh' THEN '更新'
    WHEN 'thinktank.settings.title' THEN 'Think Tank 設定'
    WHEN 'thinktank.settings.description' THEN 'Think Tank のパラメータと機能を設定'
    WHEN 'thinktank.settings.language_title' THEN '言語設定'
    WHEN 'thinktank.settings.language_description' THEN 'Think Tank インターフェースの言語を選択'
    WHEN 'thinktank.settings.interface_language' THEN 'インターフェース言語'
    WHEN 'thinktank.settings.select_language' THEN '言語を選択'
    WHEN 'thinktank.settings.available_languages' THEN '利用可能な言語'
    WHEN 'thinktank.settings.translation_coverage' THEN '翻訳カバレッジ'
    WHEN 'common.status.loading' THEN '読み込み中...'
    WHEN 'common.status.saving' THEN '保存中...'
    WHEN 'common.status.saved' THEN '保存済み'
    WHEN 'common.status.error' THEN 'エラーが発生しました'
    WHEN 'common.status.success' THEN '成功'
    WHEN 'nav.dashboard' THEN 'ダッシュボード'
    WHEN 'nav.settings' THEN '設定'
    WHEN 'nav.users' THEN 'ユーザー'
    WHEN 'nav.conversations' THEN '会話'
    WHEN 'nav.models' THEN 'モデル'
    ELSE default_text
END
FROM localization_registry
ON CONFLICT (registry_id, language_code) DO NOTHING;

-- Insert Chinese Simplified translations
INSERT INTO localization_translations (registry_id, language_code, translated_text) 
SELECT id, 'zh-CN', CASE key
    WHEN 'common.buttons.save' THEN '保存'
    WHEN 'common.buttons.cancel' THEN '取消'
    WHEN 'common.buttons.delete' THEN '删除'
    WHEN 'common.buttons.edit' THEN '编辑'
    WHEN 'common.buttons.create' THEN '创建'
    WHEN 'common.buttons.submit' THEN '提交'
    WHEN 'common.buttons.close' THEN '关闭'
    WHEN 'common.buttons.back' THEN '返回'
    WHEN 'common.buttons.next' THEN '下一步'
    WHEN 'common.buttons.refresh' THEN '刷新'
    WHEN 'thinktank.settings.title' THEN 'Think Tank 设置'
    WHEN 'thinktank.settings.description' THEN '配置 Think Tank 参数和功能'
    WHEN 'thinktank.settings.language_title' THEN '语言设置'
    WHEN 'thinktank.settings.language_description' THEN '选择您的 Think Tank 界面首选语言'
    WHEN 'thinktank.settings.interface_language' THEN '界面语言'
    WHEN 'thinktank.settings.select_language' THEN '选择语言'
    WHEN 'thinktank.settings.available_languages' THEN '可用语言'
    WHEN 'thinktank.settings.translation_coverage' THEN '翻译覆盖范围'
    WHEN 'common.status.loading' THEN '加载中...'
    WHEN 'common.status.saving' THEN '保存中...'
    WHEN 'common.status.saved' THEN '已保存'
    WHEN 'common.status.error' THEN '发生错误'
    WHEN 'common.status.success' THEN '成功'
    WHEN 'nav.dashboard' THEN '仪表板'
    WHEN 'nav.settings' THEN '设置'
    WHEN 'nav.users' THEN '用户'
    WHEN 'nav.conversations' THEN '对话'
    WHEN 'nav.models' THEN '模型'
    ELSE default_text
END
FROM localization_registry
ON CONFLICT (registry_id, language_code) DO NOTHING;

-- Insert Arabic translations
INSERT INTO localization_translations (registry_id, language_code, translated_text) 
SELECT id, 'ar', CASE key
    WHEN 'common.buttons.save' THEN 'حفظ'
    WHEN 'common.buttons.cancel' THEN 'إلغاء'
    WHEN 'common.buttons.delete' THEN 'حذف'
    WHEN 'common.buttons.edit' THEN 'تعديل'
    WHEN 'common.buttons.create' THEN 'إنشاء'
    WHEN 'common.buttons.submit' THEN 'إرسال'
    WHEN 'common.buttons.close' THEN 'إغلاق'
    WHEN 'common.buttons.back' THEN 'رجوع'
    WHEN 'common.buttons.next' THEN 'التالي'
    WHEN 'common.buttons.refresh' THEN 'تحديث'
    WHEN 'thinktank.settings.title' THEN 'إعدادات Think Tank'
    WHEN 'thinktank.settings.description' THEN 'تكوين معلمات وميزات Think Tank'
    WHEN 'thinktank.settings.language_title' THEN 'إعدادات اللغة'
    WHEN 'thinktank.settings.language_description' THEN 'اختر لغتك المفضلة لواجهة Think Tank'
    WHEN 'thinktank.settings.interface_language' THEN 'لغة الواجهة'
    WHEN 'thinktank.settings.select_language' THEN 'اختر اللغة'
    WHEN 'thinktank.settings.available_languages' THEN 'اللغات المتاحة'
    WHEN 'thinktank.settings.translation_coverage' THEN 'تغطية الترجمة'
    WHEN 'common.status.loading' THEN 'جاري التحميل...'
    WHEN 'common.status.saving' THEN 'جاري الحفظ...'
    WHEN 'common.status.saved' THEN 'تم الحفظ'
    WHEN 'common.status.error' THEN 'حدث خطأ'
    WHEN 'common.status.success' THEN 'نجاح'
    WHEN 'nav.dashboard' THEN 'لوحة القيادة'
    WHEN 'nav.settings' THEN 'الإعدادات'
    WHEN 'nav.users' THEN 'المستخدمون'
    WHEN 'nav.conversations' THEN 'المحادثات'
    WHEN 'nav.models' THEN 'النماذج'
    ELSE default_text
END
FROM localization_registry
ON CONFLICT (registry_id, language_code) DO NOTHING;

-- Insert Korean translations
INSERT INTO localization_translations (registry_id, language_code, translated_text) 
SELECT id, 'ko', CASE key
    WHEN 'common.buttons.save' THEN '저장'
    WHEN 'common.buttons.cancel' THEN '취소'
    WHEN 'common.buttons.delete' THEN '삭제'
    WHEN 'common.buttons.edit' THEN '편집'
    WHEN 'common.buttons.create' THEN '생성'
    WHEN 'common.buttons.submit' THEN '제출'
    WHEN 'common.buttons.close' THEN '닫기'
    WHEN 'common.buttons.back' THEN '뒤로'
    WHEN 'common.buttons.next' THEN '다음'
    WHEN 'common.buttons.refresh' THEN '새로고침'
    WHEN 'thinktank.settings.title' THEN 'Think Tank 설정'
    WHEN 'thinktank.settings.description' THEN 'Think Tank 매개변수 및 기능 구성'
    WHEN 'thinktank.settings.language_title' THEN '언어 설정'
    WHEN 'thinktank.settings.language_description' THEN 'Think Tank 인터페이스의 선호 언어 선택'
    WHEN 'thinktank.settings.interface_language' THEN '인터페이스 언어'
    WHEN 'thinktank.settings.select_language' THEN '언어 선택'
    WHEN 'thinktank.settings.available_languages' THEN '사용 가능한 언어'
    WHEN 'thinktank.settings.translation_coverage' THEN '번역 범위'
    WHEN 'common.status.loading' THEN '로딩 중...'
    WHEN 'common.status.saving' THEN '저장 중...'
    WHEN 'common.status.saved' THEN '저장됨'
    WHEN 'common.status.error' THEN '오류가 발생했습니다'
    WHEN 'common.status.success' THEN '성공'
    WHEN 'nav.dashboard' THEN '대시보드'
    WHEN 'nav.settings' THEN '설정'
    WHEN 'nav.users' THEN '사용자'
    WHEN 'nav.conversations' THEN '대화'
    WHEN 'nav.models' THEN '모델'
    ELSE default_text
END
FROM localization_registry
ON CONFLICT (registry_id, language_code) DO NOTHING;

-- Insert Portuguese translations
INSERT INTO localization_translations (registry_id, language_code, translated_text) 
SELECT id, 'pt', CASE key
    WHEN 'common.buttons.save' THEN 'Salvar'
    WHEN 'common.buttons.cancel' THEN 'Cancelar'
    WHEN 'common.buttons.delete' THEN 'Excluir'
    WHEN 'common.buttons.edit' THEN 'Editar'
    WHEN 'common.buttons.create' THEN 'Criar'
    WHEN 'common.buttons.submit' THEN 'Enviar'
    WHEN 'common.buttons.close' THEN 'Fechar'
    WHEN 'common.buttons.back' THEN 'Voltar'
    WHEN 'common.buttons.next' THEN 'Próximo'
    WHEN 'common.buttons.refresh' THEN 'Atualizar'
    WHEN 'thinktank.settings.title' THEN 'Configurações do Think Tank'
    WHEN 'thinktank.settings.description' THEN 'Configurar parâmetros e recursos do Think Tank'
    WHEN 'thinktank.settings.language_title' THEN 'Configurações de Idioma'
    WHEN 'thinktank.settings.language_description' THEN 'Escolha seu idioma preferido para a interface do Think Tank'
    WHEN 'thinktank.settings.interface_language' THEN 'Idioma da Interface'
    WHEN 'thinktank.settings.select_language' THEN 'Selecionar idioma'
    WHEN 'thinktank.settings.available_languages' THEN 'Idiomas Disponíveis'
    WHEN 'thinktank.settings.translation_coverage' THEN 'Cobertura de Tradução'
    WHEN 'common.status.loading' THEN 'Carregando...'
    WHEN 'common.status.saving' THEN 'Salvando...'
    WHEN 'common.status.saved' THEN 'Salvo'
    WHEN 'common.status.error' THEN 'Ocorreu um erro'
    WHEN 'common.status.success' THEN 'Sucesso'
    WHEN 'nav.dashboard' THEN 'Painel'
    WHEN 'nav.settings' THEN 'Configurações'
    WHEN 'nav.users' THEN 'Usuários'
    WHEN 'nav.conversations' THEN 'Conversas'
    WHEN 'nav.models' THEN 'Modelos'
    ELSE default_text
END
FROM localization_registry
ON CONFLICT (registry_id, language_code) DO NOTHING;

-- Insert Italian translations
INSERT INTO localization_translations (registry_id, language_code, translated_text) 
SELECT id, 'it', CASE key
    WHEN 'common.buttons.save' THEN 'Salva'
    WHEN 'common.buttons.cancel' THEN 'Annulla'
    WHEN 'common.buttons.delete' THEN 'Elimina'
    WHEN 'common.buttons.edit' THEN 'Modifica'
    WHEN 'common.buttons.create' THEN 'Crea'
    WHEN 'common.buttons.submit' THEN 'Invia'
    WHEN 'common.buttons.close' THEN 'Chiudi'
    WHEN 'common.buttons.back' THEN 'Indietro'
    WHEN 'common.buttons.next' THEN 'Avanti'
    WHEN 'common.buttons.refresh' THEN 'Aggiorna'
    WHEN 'thinktank.settings.title' THEN 'Impostazioni Think Tank'
    WHEN 'thinktank.settings.description' THEN 'Configura parametri e funzionalità di Think Tank'
    WHEN 'thinktank.settings.language_title' THEN 'Impostazioni Lingua'
    WHEN 'thinktank.settings.language_description' THEN 'Scegli la tua lingua preferita per l''interfaccia Think Tank'
    WHEN 'thinktank.settings.interface_language' THEN 'Lingua dell''Interfaccia'
    WHEN 'thinktank.settings.select_language' THEN 'Seleziona lingua'
    WHEN 'thinktank.settings.available_languages' THEN 'Lingue Disponibili'
    WHEN 'thinktank.settings.translation_coverage' THEN 'Copertura Traduzione'
    WHEN 'common.status.loading' THEN 'Caricamento...'
    WHEN 'common.status.saving' THEN 'Salvataggio...'
    WHEN 'common.status.saved' THEN 'Salvato'
    WHEN 'common.status.error' THEN 'Si è verificato un errore'
    WHEN 'common.status.success' THEN 'Successo'
    WHEN 'nav.dashboard' THEN 'Dashboard'
    WHEN 'nav.settings' THEN 'Impostazioni'
    WHEN 'nav.users' THEN 'Utenti'
    WHEN 'nav.conversations' THEN 'Conversazioni'
    WHEN 'nav.models' THEN 'Modelli'
    ELSE default_text
END
FROM localization_registry
ON CONFLICT (registry_id, language_code) DO NOTHING;

-- Insert Russian translations
INSERT INTO localization_translations (registry_id, language_code, translated_text) 
SELECT id, 'ru', CASE key
    WHEN 'common.buttons.save' THEN 'Сохранить'
    WHEN 'common.buttons.cancel' THEN 'Отмена'
    WHEN 'common.buttons.delete' THEN 'Удалить'
    WHEN 'common.buttons.edit' THEN 'Редактировать'
    WHEN 'common.buttons.create' THEN 'Создать'
    WHEN 'common.buttons.submit' THEN 'Отправить'
    WHEN 'common.buttons.close' THEN 'Закрыть'
    WHEN 'common.buttons.back' THEN 'Назад'
    WHEN 'common.buttons.next' THEN 'Далее'
    WHEN 'common.buttons.refresh' THEN 'Обновить'
    WHEN 'thinktank.settings.title' THEN 'Настройки Think Tank'
    WHEN 'thinktank.settings.description' THEN 'Настройка параметров и функций Think Tank'
    WHEN 'thinktank.settings.language_title' THEN 'Настройки языка'
    WHEN 'thinktank.settings.language_description' THEN 'Выберите предпочитаемый язык интерфейса Think Tank'
    WHEN 'thinktank.settings.interface_language' THEN 'Язык интерфейса'
    WHEN 'thinktank.settings.select_language' THEN 'Выбрать язык'
    WHEN 'thinktank.settings.available_languages' THEN 'Доступные языки'
    WHEN 'thinktank.settings.translation_coverage' THEN 'Охват перевода'
    WHEN 'common.status.loading' THEN 'Загрузка...'
    WHEN 'common.status.saving' THEN 'Сохранение...'
    WHEN 'common.status.saved' THEN 'Сохранено'
    WHEN 'common.status.error' THEN 'Произошла ошибка'
    WHEN 'common.status.success' THEN 'Успешно'
    WHEN 'nav.dashboard' THEN 'Панель'
    WHEN 'nav.settings' THEN 'Настройки'
    WHEN 'nav.users' THEN 'Пользователи'
    WHEN 'nav.conversations' THEN 'Разговоры'
    WHEN 'nav.models' THEN 'Модели'
    ELSE default_text
END
FROM localization_registry
ON CONFLICT (registry_id, language_code) DO NOTHING;
