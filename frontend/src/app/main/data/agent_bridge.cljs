;; This Source Code Form is subject to the terms of the Mozilla Public
;; License, v. 2.0. If a copy of the MPL was not distributed with this
;; file, You can obtain one at http://mozilla.org/MPL/2.0/.
;;
;; Copyright (c) KALEIDOS INC

(ns app.main.data.agent-bridge
  (:require
   [clojure.string :as str]))

(def bridge-health-port "4501")
(def bridge-health-path "/health")
(def bridge-health-poll-ms 5000)

(defn bridge-health-url
  []
  (let [location js/window.location
        protocol (.-protocol location)
        hostname (.-hostname location)]
    (str protocol "//" hostname ":" bridge-health-port bridge-health-path)))

(defn checking-state
  []
  {:status :checking
   :label "Checking bridge"
   :detail nil
   :agent-sockets 0
   :penpot-websocket :disconnected
   :mcp-plugin :disconnected})

(defn unreachable-state
  [detail]
  {:status :unreachable
   :label "Bridge unreachable"
   :detail detail
   :agent-sockets 0
   :penpot-websocket :disconnected
   :mcp-plugin :disconnected})

(defn normalize-health
  [health]
  (let [connections (:connections health)
        details     (:details health)]
    {:status        (keyword (or (:status health) "degraded"))
     :connections   {:penpot-websocket (keyword (or (:penpotWebSocket connections) "disconnected"))
                     :mcp-plugin       (keyword (or (:mcpPlugin connections) "disconnected"))
                     :agent-sockets    (or (:agentSockets connections) 0)}
     :details       {:penpot-websocket (:penpotWebSocket details)
                     :mcp-plugin       (:mcpPlugin details)}}))

(defn health->ui-state
  [health]
  (let [{:keys [status connections details]} (normalize-health health)
        penpot-status (:penpot-websocket connections)
        mcp-status    (:mcp-plugin connections)
        agent-sockets (:agent-sockets connections)
        detail        (or (:penpot-websocket details)
                          (:mcp-plugin details))
        label         (cond
                        (= status :ok) "Bridge connected"
                        (or (= penpot-status :connected)
                            (= mcp-status :connected)) "Bridge degraded"
                        :else "Bridge disconnected")]
    {:status status
     :label label
     :detail detail
     :agent-sockets agent-sockets
     :penpot-websocket penpot-status
     :mcp-plugin mcp-status}))

(defn status-class
  [status]
  (-> status name (str/replace #"_" "-")))
