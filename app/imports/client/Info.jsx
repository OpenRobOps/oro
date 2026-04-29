/**
 * Copyright 2026 InOrbit, Inc.
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

import { useFind, useSubscribe } from "meteor/react-meteor-data";
import { LinksCollection } from "../api/links";

export const Info = () => {
  const isLoading = useSubscribe("links");
  const links = useFind(() => LinksCollection.find());

  if (isLoading()) {
    return <div>Loading...</div>;
  }

  return (
    <section>
      <h2 className="section-title">Learn Meteor!</h2>
      <ul className="resources-grid">
        {links.map((link) => (
          <li className="section" key={link._id}>
            <a href={link.url} className="resource-link" target="_blank">
              <div className="card resource-card">
                <div className="resource-content">
                  <span className="resource-title">{link.title}</span>
                </div>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
};
