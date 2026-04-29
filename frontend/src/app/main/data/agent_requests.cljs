;; This Source Code Form is subject to the terms of the Mozilla Public
;; License, v. 2.0. If a copy of the MPL was not distributed with this
;; file, You can obtain one at http://mozilla.org/MPL/2.0/.
;;
;; Copyright (c) KALEIDOS INC

(ns app.main.data.agent-requests)

(def agent-request-port "4501")

(defn agent-requests-base-url
  []
  (let [location js/window.location
        protocol (.-protocol location)
        hostname (.-hostname location)]
    (str protocol "//" hostname ":" agent-request-port "/agent-requests")))

(defn idle-state
  []
  {:open? false
   :prompt ""
   :status :idle
   :request-id nil
   :message nil
   :action-task nil
   :action-label nil})

(defn open-state
  [state]
  (assoc state :open? true))

(defn close-state
  []
  (idle-state))

(defn update-prompt
  [state prompt]
  (assoc state :prompt prompt))

(defn pending-state
  [state request]
  (assoc state
         :status :pending
         :request-id (:id request)
         :action-task nil
         :action-label nil
         :message "Request pending"))

(defn accepted-state
  [state request]
  (assoc state
         :status :accepted
         :request-id (:id request)
         :message "Request accepted"
         :action-task (get-in request [:action :request :task])
         :action-label (get-in request [:action :request :params :label])
         :prompt (:prompt state "")))

(defn failed-state
  [state message]
  (assoc state
         :status :failed
         :action-task nil
         :action-label nil
         :message message))
