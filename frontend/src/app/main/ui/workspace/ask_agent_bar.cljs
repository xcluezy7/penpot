;; This Source Code Form is subject to the terms of the Mozilla Public
;; License, v. 2.0. If a copy of the MPL was not distributed with this
;; file, You can obtain one at http://mozilla.org/MPL/2.0/.
;;
;; Copyright (c) KALEIDOS INC

(ns app.main.ui.workspace.ask-agent-bar
  (:require-macros [app.main.style :as stl])
  (:require
   [app.main.data.agent-requests :as dar]
   [app.util.dom :as dom]
   [rumext.v2 :as mf]))

(defn- submit-request!
  [state*]
  (let [{:keys [prompt]} @state*
        body #js {:prompt prompt}]
    (-> (js/fetch (dar/agent-requests-base-url)
                  #js {:method "POST"
                       :headers #js {"Content-Type" "application/json"}
                       :body (js/JSON.stringify body)})
        (.then (fn [response]
                 (if (.-ok response)
                   (.json response)
                   (js/Promise.reject (js/Error. "Request failed")))))
        (.then (fn [payload]
                 (let [request (js->clj payload :keywordize-keys true)]
                   (swap! state* dar/pending-state request)
                   (js/fetch (str (dar/agent-requests-base-url) "/" (:id request))))))
        (.then (fn [response]
                 (if (.-ok response)
                   (.json response)
                   (js/Promise.reject (js/Error. "Status fetch failed")))))
        (.then (fn [payload]
                 (let [request (js->clj payload :keywordize-keys true)]
                   (swap! state* dar/accepted-state request))))
        (.catch (fn [error]
                  (swap! state* dar/failed-state (.-message error)))))))

(mf/defc ask-agent-bar*
  {::mf/wrap [mf/memo]
   ::mf/wrap-props false}
  []
  (let [state* (mf/use-state (dar/idle-state))
        {:keys [open? prompt status message action-task action-label]} (deref state*)
        on-open (mf/use-fn #(swap! state* dar/open-state))
        on-close (mf/use-fn #(reset! state* (dar/close-state)))
        on-change
        (mf/use-fn
         (fn [event]
           (let [value (-> event dom/get-target dom/get-value)]
             (swap! state* dar/update-prompt value))))
        on-submit
        (mf/use-fn
         (fn [event]
           (dom/prevent-default event)
           (submit-request! state*)))]
    [:div {:class (stl/css :ask-agent-bar)}
     (if open?
       [:form {:class (stl/css :ask-agent-form)
               :on-submit on-submit}
        [:input {:class (stl/css :ask-agent-input)
                 :data-testid "ask-agent-input"
                 :placeholder "Ask Agent"
                 :value prompt
                 :on-change on-change}]
        [:button {:class (stl/css :ask-agent-submit)
                  :data-testid "ask-agent-submit"
                  :disabled (or (= status :pending)
                                (= "" prompt))
                  :type "submit"}
         "Send"]
        [:button {:class (stl/css :ask-agent-cancel)
                  :data-testid "ask-agent-cancel"
                  :on-click on-close
                  :type "button"}
         "Close"]]
       [:button {:class (stl/css :ask-agent-toggle)
                 :data-testid "ask-agent-toggle"
                 :on-click on-open
                 :type "button"}
        "Ask Agent"])

     (when (not= status :idle)
       [:div {:class (stl/css-case :ask-agent-status true
                                   :pending (= status :pending)
                                   :accepted (= status :accepted)
                                   :failed (= status :failed))
              :data-testid "ask-agent-status"}
        [:span message]
        (when action-task
          [:span {:class (stl/css :ask-agent-action-task)
                  :data-testid "ask-agent-action-task"}
           (str " · Action " action-task)])
        (when action-label
          [:span {:class (stl/css :ask-agent-action-label)
                  :data-testid "ask-agent-action-label"}
           (str " · Preview " action-label)])])]))
