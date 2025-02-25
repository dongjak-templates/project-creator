import { Template } from './Template.js';
import { ReactTemplate } from './ReactTemplate.js';
import { NodeExpressTemplate } from './NodeExpressTemplate.js';
import { VueTemplate } from './VueTemplate.js';

/**
 * 加载所有可用的模板
 */
export function loadTemplates(): Template[] {
  return [
    new ReactTemplate(),
    new NodeExpressTemplate(),
    new VueTemplate()
  ];
}
