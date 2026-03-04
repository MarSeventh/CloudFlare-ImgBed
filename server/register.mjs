/**
 * ESM Loader 注册入口
 * 通过 node --import ./server/register.mjs 使用
 */
import { register } from 'node:module';

register('./loader.mjs', import.meta.url);
