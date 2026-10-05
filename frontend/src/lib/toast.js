import { toast as baseToast } from 'react-toastify';
import { DICTS, translate } from '@/i18n';

function flattenStrings(value, prefix = '', result = []) {
  for (const [key, item] of Object.entries(value || {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof item === 'string') result.push([path, item]);
    else if (item && typeof item === 'object') flattenStrings(item, path, result);
  }
  return result;
}

const toastMessages = Object.entries(DICTS)
  .filter(([code]) => code !== 'en')
  .flatMap(([, dictionary]) => flattenStrings(dictionary))
  .map(([key, message]) => ({
    key,
    pattern: new RegExp(`^${message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{(\w+)\\\}/g, '(.+?)')}$`),
    variables: [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]),
  }));

function fallbackFor(type) {
  if (type === 'success') return 'Done successfully.';
  if (type === 'warning' || type === 'warn') return 'Please review this before continuing.';
  if (type === 'info' || type === 'loading') return 'Please check the latest update.';
  return 'Something went wrong. Please try again.';
}

function englishMessage(message, type) {
  if (typeof message !== 'string') return fallbackFor(type);

  for (const entry of toastMessages) {
    const match = entry.pattern.exec(message);
    if (!match) continue;
    const variables = Object.fromEntries(entry.variables.map((name, index) => [name, match[index + 1]]));
    return translate('en', entry.key, variables);
  }

  if (!/[\u0900-\u097f]/.test(message) && !/\b(?:hai|hain|nahi|karo|kijiye|chahiye|mile|bhejo|dobara|aap|mein|pehle)\b/i.test(message)) {
    return message;
  }
  return fallbackFor(type);
}

const methods = new Set(['success', 'error', 'info', 'warn', 'warning', 'loading']);

const toast = new Proxy(baseToast, {
  get(target, property, receiver) {
    const method = Reflect.get(target, property, receiver);
    if (methods.has(property) && typeof method === 'function') {
      return (message, ...args) => method.call(target, englishMessage(message, property), ...args);
    }
    if (property === 'update' && typeof method === 'function') {
      return (id, options) => method.call(target, id, {
        ...options,
        ...(options?.render !== undefined ? { render: englishMessage(options.render, options.type || 'info') } : {}),
      });
    }
    return method;
  },
});

export { toast };
export default toast;