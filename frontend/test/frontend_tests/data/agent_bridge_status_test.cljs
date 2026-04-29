;; This Source Code Form is subject to the terms of the Mozilla Public
;; License, v. 2.0. If a copy of the MPL was not distributed with this
;; file, You can obtain one at http://mozilla.org/MPL/2.0/.
;;
;; Copyright (c) KALEIDOS INC

(ns frontend-tests.data.agent-bridge-status-test
  (:require
   [app.main.data.agent-bridge :as dab]
   [clojure.test :as t]))

(t/deftest normalize-health-defaults-missing-fields
  (let [health (dab/normalize-health {})]
    (t/is (= :degraded (:status health)))
    (t/is (= :disconnected (get-in health [:connections :penpot-websocket])))
    (t/is (= :disconnected (get-in health [:connections :mcp-plugin])))
    (t/is (= 0 (get-in health [:connections :agent-sockets])))))

(t/deftest health-to-ui-state-maps-ok-and-agent-count
  (let [ui-state (dab/health->ui-state {:status "ok"
                                        :connections {:penpotWebSocket "connected"
                                                      :mcpPlugin "connected"
                                                      :agentSockets 3}
                                        :details {:penpotWebSocket nil
                                                  :mcpPlugin nil}})]
    (t/is (= :ok (:status ui-state)))
    (t/is (= "Bridge connected" (:label ui-state)))
    (t/is (= 3 (:agent-sockets ui-state)))))

(t/deftest unreachable-state-is-explicit
  (let [ui-state (dab/unreachable-state "Network error")]
    (t/is (= :unreachable (:status ui-state)))
    (t/is (= "Bridge unreachable" (:label ui-state)))
    (t/is (= "Network error" (:detail ui-state)))))
