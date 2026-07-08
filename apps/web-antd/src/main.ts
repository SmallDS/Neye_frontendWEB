import { initPreferences, updateCustomPreferences, updatePreferences } from '@vben/preferences';
import { unmountGlobalLoading } from '@vben/utils';

import { overridesPreferences, preferencesExtension } from './preferences';

/**
 * 应用初始化完成之后再进行页面加载渲染
 */
async function initApplication() {
  const env = import.meta.env.PROD ? 'prod' : 'dev';
  const appVersion = import.meta.env.VITE_APP_VERSION;
  const namespace = `${import.meta.env.VITE_APP_NAMESPACE}-${appVersion}-${env}`;

  await initPreferences({
    extension: preferencesExtension,
    namespace,
    overrides: overridesPreferences,
  });
  updatePreferences({ app: { defaultHomePath: '/neye/system/tenants' } });
  updateCustomPreferences({ tenantMode: 'multi' });

  const { bootstrap } = await import('./bootstrap');
  await bootstrap(namespace);

  unmountGlobalLoading();
}

initApplication();