;; This Source Code Form is subject to the terms of the Mozilla Public
;; License, v. 2.0. If a copy of the MPL was not distributed with this
;; file, You can obtain one at http://mozilla.org/MPL/2.0/.
;;
;; Copyright (c) KALEIDOS INC

(ns app.main.ui.workspace.agent-bridge-status
  (:require-macros [app.main.style :as stl])
  (:require
   [app.main.data.agent-bridge :as dab]
   [rumext.v2 :as mf]))

(defn- fetch-health!
  [state*]
  (-> (js/fetch (dab/bridge-health-url))
      (.then (fn [response]
               (.json response)))
      (.then (fn [payload]
               (reset! state* (dab/health->ui-state (js->clj payload :keywordize-keys true)))))
      (.catch (fn [error]
                (reset! state* (dab/unreachable-state (.-message error)))))))

(mf/defc agent-bridge-status*
  {::mf/wrap [mf/memo]
   ::mf/wrap-props false}
  []
  (let [state* (mf/use-state (dab/checking-state))]
    (mf/use-effect
     #js []
     (fn []
       (fetch-health! state*)
       (let [timer (js/setInterval #(fetch-health! state*) dab/bridge-health-poll-ms)]
         #(js/clearInterval timer))))

    (let [{:keys [status label detail agent-sockets penpot-websocket mcp-plugin]} (deref state*)]
      [:div {:class (stl/css-case :agent-bridge-status true
                                  :connected (= status :ok)
                                  :degraded (= status :degraded)
                                  :unreachable (= status :unreachable)
                                  :checking (= status :checking))
             :data-testid "agent-bridge-status"
             :title (or detail label)}
       [:span {:class (stl/css :agent-bridge-dot)}]
       [:span {:class (stl/css :agent-bridge-label)} label]
       [:span {:class (stl/css :agent-bridge-meta)
               :data-testid "agent-bridge-status-meta"}
        (str "WS " (name penpot-websocket) " · MCP " (name mcp-plugin) " · Agents " agent-sockets)]])))
