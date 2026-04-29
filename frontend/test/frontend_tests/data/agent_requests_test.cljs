;; This Source Code Form is subject to the terms of the Mozilla Public
;; License, v. 2.0. If a copy of the MPL was not distributed with this
;; file, You can obtain one at http://mozilla.org/MPL/2.0/.
;;
;; Copyright (c) KALEIDOS INC

(ns frontend-tests.data.agent-requests-test
  (:require
   [app.main.data.agent-requests :as dar]
   [clojure.test :as t]))

(t/deftest pending-state-stores-request-id-and-message
  (let [state (dar/pending-state (dar/open-state (dar/idle-state)) {:id "request-1"})]
    (t/is (= :pending (:status state)))
    (t/is (= "request-1" (:request-id state)))
    (t/is (= "Request pending" (:message state)))))

(t/deftest accepted-state-updates-visible-message
  (let [state (-> (dar/idle-state)
                  (dar/update-prompt "Review the sidebar")
                  (dar/accepted-state {:id "request-2"
                                       :action {:request {:task "createAgentMarker"
                                                          :params {:label "Agent: Review the sidebar"}}}}))]
    (t/is (= :accepted (:status state)))
    (t/is (= "Request accepted" (:message state)))
    (t/is (= "request-2" (:request-id state)))
    (t/is (= "createAgentMarker" (:action-task state)))
    (t/is (= "Agent: Review the sidebar" (:action-label state)))))

(t/deftest failed-state-retains-error-message
  (let [state (dar/failed-state (dar/idle-state) "Bridge unavailable")]
    (t/is (= :failed (:status state)))
    (t/is (= "Bridge unavailable" (:message state)))))
