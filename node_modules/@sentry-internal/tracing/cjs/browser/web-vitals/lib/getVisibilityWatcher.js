Object.defineProperty(exports, '__esModule', { value: true });

const types = require('../../types.js');
const onHidden = require('./onHidden.js');

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

let firstHiddenTime = -1;

const initHiddenTime = () => {
  // If the document is hidden and not prerendering, assume it was always
  // hidden and the page was loaded in the background.
  if (types.WINDOW.document && types.WINDOW.document.visibilityState) {
    firstHiddenTime = types.WINDOW.document.visibilityState === 'hidden' && !types.WINDOW.document.prerendering ? 0 : Infinity;
  }
};

const trackChanges = () => {
  // Update the time if/when the document becomes hidden.
  onHidden.onHidden(({ timeStamp }) => {
    firstHiddenTime = timeStamp;
  }, true);
};

const getVisibilityWatcher = (

) => {
  if (firstHiddenTime < 0) {
    // If the document is hidden when this code runs, assume it was hidden
    // since navigation start. This isn't a perfect heuristic, but it's the
    // best we can do until an API is available to support querying past
    // visibilityState.
    initHiddenTime();
    trackChanges();
  }
  return {
    get firstHiddenTime() {
      return firstHiddenTime;
    },
  };
};

exports.getVisibilityWatcher = getVisibilityWatcher;
//# sourceMappingURL=getVisibilityWatcher.js.map
