Object.defineProperty(exports, '__esModule', { value: true });

const types = require('../../types.js');
const generateUniqueID = require('./generateUniqueID.js');
const getActivationStart = require('./getActivationStart.js');
const getNavigationEntry = require('./getNavigationEntry.js');

/*
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const initMetric = (name, value) => {
  const navEntry = getNavigationEntry.getNavigationEntry();
  let navigationType = 'navigate';

  if (navEntry) {
    if ((types.WINDOW.document && types.WINDOW.document.prerendering) || getActivationStart.getActivationStart() > 0) {
      navigationType = 'prerender';
    } else {
      navigationType = navEntry.type.replace(/_/g, '-') ;
    }
  }

  return {
    name,
    value: typeof value === 'undefined' ? -1 : value,
    rating: 'good', // Will be updated if the value changes.
    delta: 0,
    entries: [],
    id: generateUniqueID.generateUniqueID(),
    navigationType,
  };
};

exports.initMetric = initMetric;
//# sourceMappingURL=initMetric.js.map
