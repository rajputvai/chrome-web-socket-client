$(document).ready(function() {
  var ReadyState = {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3
  };

  var LogMessageType = {
    TEXT: 'text',
    BINARY: 'binary'
  };

  var LogMessageSender = {
    SYSTEM: 'SYSTEM',
    LOCAL: 'LOCAL',
    REMOTE: 'REMOTE',
    CONSOLE: 'CONSOLE'
  };

  var MAX_LOG_SIZE = 500;

  var HEARTBEAT_TIMEOUT_IN_MS = 10000 

  var closeCodeToString = function(code) {
      code = Number(code);

      if (code >= 0 && code <= 999) {
        return 'UNKNOWN_UNUSED_CODE';
      }
      
      if (code >= 1016 && code <= 1999) {
        return 'UNKNOWN_WEBSOCKET_CODE';
      }
      
      if (code >= 2000 && code <= 2999) {
        return 'UNKNOWN_EXTENSION_CODE';
      }
      
      if (code >= 3000 && code <= 3999) {
        return 'UNKNOWN_FRAMEWORK_CODE';
      }
      
      if (code >= 4000 && code <= 4999) {
        return 'UNKNOWN_APPLICATION_CODE';
      }

      switch (code) {
        case 1000: return 'NORMAL';
        case 1001: return 'GOING_AWAY';
        case 1002: return 'PROTOCOL_ERROR';
        case 1003: return 'UNSUPPORTED';
        case 1014: // fall through
        case 1004: return 'UNKNOWN_RESERVED_CODE';
        case 1005: return 'NO_STATUS_RECVD';
        case 1006: return 'ABNORMAL';
        case 1007: return 'UNSUPPORTED_DATA';
        case 1008: return 'POLICY_VIOLATION';
        case 1009: return 'TOO_LARGE';
        case 1010: return 'MISSING_EXTENSION';
        case 1011: return 'INTERNAL_ERROR';
        case 1012: return 'RESTARTING';
        case 1013: return 'TRY_AGAIN_LATER';
        case 1015: return 'TLS_HANDSHAKE';
        default:
          break;
      }

      return 'UNKNOWN';
  };

  var socket = null;

  var transition = function() {
    $(".controls").removeClass("open closed closing connecting");
    $(".controls input").removeAttr("disabled");
    $(".controls textarea").removeAttr("disabled");
    $(".controls select").removeAttr("disabled");

    if (socket == null || socket.readyState == ReadyState.CLOSED) {
      $(".controls").addClass("closed");
      $(".controls #btn_close").attr("disabled", "disabled");
      $(".controls #close_status").attr("disabled", "disabled");
      $(".controls #close_reason").attr("disabled", "disabled");
      $(".controls #btn_send").attr("disabled", "disabled");
      $(".controls #message_text").attr("disabled", "disabled");
    }
    else if (socket.readyState == ReadyState.CONNECTING) {
      $(".controls").addClass("connecting");
      $(".controls #endpoint").attr("disabled", "disabled");
      $(".controls #protocols").attr("disabled", "disabled");
      $(".controls #reconnect").attr("disabled", "disabled"); 
      $(".controls #btn_connect").attr("disabled", "disabled");
      $(".controls #btn_send").attr("disabled", "disabled");
      $(".controls #message_text").attr("disabled", "disabled");
      $(".controls #close_status").attr("disabled", "disabled");
      $(".controls #close_reason").attr("disabled", "disabled");
    }
    else if (socket.readyState == ReadyState.CLOSING) {
      $(".controls").addClass("closing");
      $(".controls #endpoint").attr("disabled", "disabled");
      $(".controls #protocols").attr("disabled", "disabled");
      $(".controls #reconnect").attr("disabled", "disabled");
      $(".controls #btn_connect").attr("disabled", "disabled");
      $(".controls #btn_close").attr("disabled", "disabled");
      $(".controls #close_status").attr("disabled", "disabled");
      $(".controls #close_reason").attr("disabled", "disabled");
      $(".controls #btn_send").attr("disabled", "disabled");
      $(".controls #message_text").attr("disabled", "disabled");
    }
    else if (socket.readyState == ReadyState.OPEN) {
      $(".controls").addClass("open");
      $(".controls #endpoint").attr("disabled", "disabled");
      $(".controls #protocols").attr("disabled", "disabled");
      $(".controls #reconnect").attr("disabled", "disabled");
      $(".controls #btn_connect").attr("disabled", "disabled");
    }
    else {
      window.console.log("Invalid socket ready state.", socket);
      throw new Error("Invalid socket ready state.");
    }
  };

  var logIsScrolledToBottom = function() {
    var j = $(".log");
    var e = j[0];
    return e.scrollTop + j.height() + 10 /* padding */ >= e.scrollHeight - 10 /* some tolerance */;
  };

  var scrollLogToBottom = function() {
    var e = $(".log")[0];
    e.scrollTop = e.scrollHeight;
  };

  var pruneLog = function() {
    var e = $(".log .entries");

    if (e.length == 0) {
      return;
    }

    // Prune the oldest entry.
    if (e[0].children.length == MAX_LOG_SIZE) {
      e[0].children[0].remove();
    }
  };

  var clearLog = function() {
    $(".log .entries").empty();
  };

  var addLogEntry = function(sender, type, data) {
    // pruneLog();

    if (type == LogMessageType.BINARY) {
      data = '(BINARY MESSAGE: ' + data.size + ' bytes)\n' + blobToHex(data);
    } else {
      data = data || '(empty message)';
    }
    var date = new Date();
    var entry = $("<div>").addClass('entry');
    var timestamp = $("<span>").addClass('timestamp').text(`${date.toISOString()} `);
    var publisher = $("<span>").addClass('publisher').addClass(sender.toLowerCase()).text(`${sender}`);
    var content = $("<div>").addClass('content').addClass(type).text(` - ${data}`);
    content.prepend(publisher)
    content.prepend(timestamp)
    entry.append(content);
    var scroll = logIsScrolledToBottom();
    $(".log .entries").append(entry);
    if (scroll) {
      scrollLogToBottom();
    }
  };

  var maybeReconnect = function() {
    if ($("#reconnect").is(":checked") && 
        !socket.__isClientClose) {
      connect($("#endpoint").val(), $("#protocols").val());
    }
  };

  var blobToHex = function(blob) {
      // TODO: Implement (seems to be non-trivial).
      return '';
  };

  var connect = function(url, protocols) {
    protocols = parseProtocols(protocols);
    try {
        socket = new WebSocket(url, protocols);
    } catch (err) {
      addLogEntry(LogMessageSender.SYSTEM,
                  LogMessageType.TEXT,
                  'Unable to open connection: ' + err);
    }
    socket.binaryType = "blob";
    socket.__openTime = Date.now();
    addLogEntry(LogMessageSender.SYSTEM, 
                LogMessageType.TEXT, 
                "Attempt to connect to '" + socket.url + "'...");
    transition();

    socket.onclose = function(event) {
      addLogEntry(LogMessageSender.SYSTEM, 
                  LogMessageType.TEXT, 
                  "The connection was terminated " + (event.wasClean ? 'cleanly' : 'uncleanly')+ " with status " + 
                  "code " + event.code + " (" + closeCodeToString(event.code) + ").\n" + 
                  (event.reason ? 'The reason provided was: ' + event.reason + '\n' : ''));
      transition();
      maybeReconnect();
    };
    socket.onerror = function(event) {
      // No way to access error message via JS API... Lame.
      addLogEntry(LogMessageSender.SYSTEM, 
                  LogMessageType.TEXT, 
                  "An error occured with the connection - refer to the Chrome developer console for detailed error info.");
      transition();
    };
    socket.onmessage = function(event) {
      if (typeof event.data == 'string') {
        addLogEntry(LogMessageSender.REMOTE,
                    LogMessageType.TEXT,
                    event.data);
        onMessageHandler(event.data);
      } 
      else if (event.data instanceof Blob) {
        addLogEntry(LogMessageSender.REMOTE,
                    LogMessageType.BINARY,
                    event.data);
      }
      else {
        window.console.log('Bad data type: ', event.data);
        throw new Error('Bad data type received.');
      }
    };
    socket.onopen = function(event) {
      addLogEntry(LogMessageSender.SYSTEM,
                  LogMessageType.TEXT,
                  "The connection was established successfully (in " + (Date.now() - socket.__openTime)+ " ms).\n" + 
                  (socket.extensions ? 'Negotiated Extensions: ' + socket.extensions : '') + 
                  (socket.protocol ? 'Negotiated Protocol: ' + socket.protocol : ''));
      sendHeartbeat();
      transition();
    };
  };

  let lastHeartbeatSentAt = 0;
  let lastHeartbeatReceivedAt = 0;
  let hearbeatTimeoutFunc = undefined;

  const onMessageHandler = (message) => {
    const data = JSON.parse(message);
    if (!data)
      return undefined;
    if (!data.command)
      return undefined;
    const command = data.command
    switch(command) {
      case "heartbeat": 
        if (data.event_id === "websocketClient" && data.res === "ack") {
          lastHeartbeatReceivedAt = Date.now();
          lastHeartbeatSentAt = 0
          setTimeout(sendHeartbeat, 1000);
          clearTimeout(hearbeatTimeoutFunc);
        }
    }
  }

  const sendHeartbeat = () => {
    const now = Date.now();
    lastHeartbeatSentAt = now;
    lastHeartbeatReceivedAt = 0
    sendText(JSON.stringify({
      command: 'heartbeat',
      intent_utc: now,
      timestamp: now,
      event_id: 'websocketClient'
    }))
    hearbeatTimeoutFunc = setTimeout(checkHeartbeatTimeout, HEARTBEAT_TIMEOUT_IN_MS + 100);
  }

  const checkHeartbeatTimeout = () => {
    const diff = Math.abs(lastHeartbeatSentAt - lastHeartbeatReceivedAt);
    console.info("checking timeout", diff)
    if (diff > HEARTBEAT_TIMEOUT_IN_MS) {
      close(1000, `Heartbeat timeout`, true);
    }
  }

  var sendText = function(text) {
    addLogEntry(LogMessageSender.LOCAL,
                LogMessageType.TEXT,
                text);
    socket.send(text);
  };

  var sendBytes = function(bytes) {
    // TODO: Implement.
    // Same as sendText but pass a Blob or ArrayBuffer into send().
  };

  var parseProtocols = function(s) {
    var p = s.split(",")
             .map(function(x) { return x.trim(); })
             .filter(function(x) { return x.length > 0; });
    
    if (p.length > 0) {
      return p;
    }
    
    return undefined;
  };

  var close = function(code, reason, programaticallyClose = false) {
    if (!programaticallyClose) {
      socket.__isClientClose = true; // Prevent re-connects.
    }

    try {
      socket.close(Number(code), reason);
    } catch (err) {
      socket.__isClientClose = false;
      addLogEntry(LogMessageSender.SYSTEM,
                  LogMessageType.TEXT,
                  'Unable to close connection: ' + err);
    }
  };

  var updateCloseText = function() {
    $("#close_status_text").text(closeCodeToString($("#close_status").val()));
  }

  $("#btn_connect").on('click', function(event) {
    event.preventDefault();
    connect($("#endpoint").val(), $("#protocols").val());
  });

  $("#btn_send").on('click', function(event) {
    event.preventDefault();
    sendText($("#message_text").val());
    scrollLogToBottom();
  });

  $("#btn_close").on('click', function(event) {
    event.preventDefault();
    close($("#close_status").val(), $("#close_reason").val());
  });

  $("#btn_clear_log").on('click', function(event) {
    event.preventDefault();
    clearLog();
  });

  $("#close_status").on('change', function(event) {
    updateCloseText();
  });

  transition();
  updateCloseText();

  addLogEntry(LogMessageSender.CONSOLE,
              LogMessageType.TEXT, 
              'Welcome! You may initiate and manage a web socket connection using the controls above. Messages sent and received will appear in this log.');
});
