(() => {
  // node_modules/@capacitor/core/dist/index.js
  var ExceptionCode;
  (function(ExceptionCode2) {
    ExceptionCode2["Unimplemented"] = "UNIMPLEMENTED";
    ExceptionCode2["Unavailable"] = "UNAVAILABLE";
  })(ExceptionCode || (ExceptionCode = {}));
  var CapacitorException = class extends Error {
    constructor(message, code, data) {
      super(message);
      this.message = message;
      this.code = code;
      this.data = data;
    }
  };
  var getPlatformId = (win) => {
    var _a, _b;
    if (win === null || win === void 0 ? void 0 : win.androidBridge) {
      return "android";
    } else if ((_b = (_a = win === null || win === void 0 ? void 0 : win.webkit) === null || _a === void 0 ? void 0 : _a.messageHandlers) === null || _b === void 0 ? void 0 : _b.bridge) {
      return "ios";
    } else {
      return "web";
    }
  };
  var createCapacitor = (win) => {
    const capCustomPlatform = win.CapacitorCustomPlatform || null;
    const cap = win.Capacitor || {};
    const Plugins = cap.Plugins = cap.Plugins || {};
    const getPlatform = () => {
      return capCustomPlatform !== null ? capCustomPlatform.name : getPlatformId(win);
    };
    const isNativePlatform = () => getPlatform() !== "web";
    const isPluginAvailable = (pluginName) => {
      const plugin = registeredPlugins.get(pluginName);
      if (plugin === null || plugin === void 0 ? void 0 : plugin.platforms.has(getPlatform())) {
        return true;
      }
      if (getPluginHeader(pluginName)) {
        return true;
      }
      return false;
    };
    const getPluginHeader = (pluginName) => {
      var _a;
      return (_a = cap.PluginHeaders) === null || _a === void 0 ? void 0 : _a.find((h) => h.name === pluginName);
    };
    const handleError = (err) => win.console.error(err);
    const registeredPlugins = /* @__PURE__ */ new Map();
    const registerPlugin2 = (pluginName, jsImplementations = {}) => {
      const registeredPlugin = registeredPlugins.get(pluginName);
      if (registeredPlugin) {
        console.warn(`Capacitor plugin "${pluginName}" already registered. Cannot register plugins twice.`);
        return registeredPlugin.proxy;
      }
      const platform = getPlatform();
      const pluginHeader = getPluginHeader(pluginName);
      let jsImplementation;
      const loadPluginImplementation = async () => {
        if (!jsImplementation && platform in jsImplementations) {
          jsImplementation = typeof jsImplementations[platform] === "function" ? jsImplementation = await jsImplementations[platform]() : jsImplementation = jsImplementations[platform];
        } else if (capCustomPlatform !== null && !jsImplementation && "web" in jsImplementations) {
          jsImplementation = typeof jsImplementations["web"] === "function" ? jsImplementation = await jsImplementations["web"]() : jsImplementation = jsImplementations["web"];
        }
        return jsImplementation;
      };
      const createPluginMethod = (impl, prop) => {
        var _a, _b;
        if (pluginHeader) {
          const methodHeader = pluginHeader === null || pluginHeader === void 0 ? void 0 : pluginHeader.methods.find((m) => prop === m.name);
          if (methodHeader) {
            if (methodHeader.rtype === "promise") {
              return (options) => cap.nativePromise(pluginName, prop.toString(), options);
            } else {
              return (options, callback) => cap.nativeCallback(pluginName, prop.toString(), options, callback);
            }
          } else if (impl) {
            return (_a = impl[prop]) === null || _a === void 0 ? void 0 : _a.bind(impl);
          }
        } else if (impl) {
          return (_b = impl[prop]) === null || _b === void 0 ? void 0 : _b.bind(impl);
        } else {
          throw new CapacitorException(`"${pluginName}" plugin is not implemented on ${platform}`, ExceptionCode.Unimplemented);
        }
      };
      const createPluginMethodWrapper = (prop) => {
        let remove;
        const wrapper = (...args) => {
          const p = loadPluginImplementation().then((impl) => {
            const fn = createPluginMethod(impl, prop);
            if (fn) {
              const p2 = fn(...args);
              remove = p2 === null || p2 === void 0 ? void 0 : p2.remove;
              return p2;
            } else {
              throw new CapacitorException(`"${pluginName}.${prop}()" is not implemented on ${platform}`, ExceptionCode.Unimplemented);
            }
          });
          if (prop === "addListener") {
            p.remove = async () => remove();
          }
          return p;
        };
        wrapper.toString = () => `${prop.toString()}() { [capacitor code] }`;
        Object.defineProperty(wrapper, "name", {
          value: prop,
          writable: false,
          configurable: false
        });
        return wrapper;
      };
      const addListener = createPluginMethodWrapper("addListener");
      const removeListener2 = createPluginMethodWrapper("removeListener");
      const addListenerNative = (eventName, callback) => {
        const call = addListener({ eventName }, callback);
        const remove = async () => {
          const callbackId = await call;
          removeListener2({
            eventName,
            callbackId
          }, callback);
        };
        const p = new Promise((resolve) => call.then(() => resolve({ remove })));
        p.remove = async () => {
          console.warn(`Using addListener() without 'await' is deprecated.`);
          await remove();
        };
        return p;
      };
      const proxy = new Proxy({}, {
        get(_, prop) {
          switch (prop) {
            // https://github.com/facebook/react/issues/20030
            case "$$typeof":
              return void 0;
            case "toJSON":
              return () => ({});
            case "addListener":
              return pluginHeader ? addListenerNative : addListener;
            case "removeListener":
              return removeListener2;
            default:
              return createPluginMethodWrapper(prop);
          }
        }
      });
      Plugins[pluginName] = proxy;
      registeredPlugins.set(pluginName, {
        name: pluginName,
        proxy,
        platforms: /* @__PURE__ */ new Set([...Object.keys(jsImplementations), ...pluginHeader ? [platform] : []])
      });
      return proxy;
    };
    if (!cap.convertFileSrc) {
      cap.convertFileSrc = (filePath) => filePath;
    }
    cap.getPlatform = getPlatform;
    cap.handleError = handleError;
    cap.isNativePlatform = isNativePlatform;
    cap.isPluginAvailable = isPluginAvailable;
    cap.registerPlugin = registerPlugin2;
    cap.Exception = CapacitorException;
    cap.DEBUG = !!cap.DEBUG;
    cap.isLoggingEnabled = !!cap.isLoggingEnabled;
    return cap;
  };
  var initCapacitorGlobal = (win) => win.Capacitor = createCapacitor(win);
  var Capacitor = /* @__PURE__ */ initCapacitorGlobal(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
  var registerPlugin = Capacitor.registerPlugin;
  var WebPlugin = class {
    constructor() {
      this.listeners = {};
      this.retainedEventArguments = {};
      this.windowListeners = {};
    }
    addListener(eventName, listenerFunc) {
      let firstListener = false;
      const listeners = this.listeners[eventName];
      if (!listeners) {
        this.listeners[eventName] = [];
        firstListener = true;
      }
      this.listeners[eventName].push(listenerFunc);
      const windowListener = this.windowListeners[eventName];
      if (windowListener && !windowListener.registered) {
        this.addWindowListener(windowListener);
      }
      if (firstListener) {
        this.sendRetainedArgumentsForEvent(eventName);
      }
      const remove = async () => this.removeListener(eventName, listenerFunc);
      const p = Promise.resolve({ remove });
      return p;
    }
    async removeAllListeners() {
      this.listeners = {};
      for (const listener in this.windowListeners) {
        this.removeWindowListener(this.windowListeners[listener]);
      }
      this.windowListeners = {};
    }
    notifyListeners(eventName, data, retainUntilConsumed) {
      const listeners = this.listeners[eventName];
      if (!listeners) {
        if (retainUntilConsumed) {
          let args = this.retainedEventArguments[eventName];
          if (!args) {
            args = [];
          }
          args.push(data);
          this.retainedEventArguments[eventName] = args;
        }
        return;
      }
      listeners.forEach((listener) => listener(data));
    }
    hasListeners(eventName) {
      var _a;
      return !!((_a = this.listeners[eventName]) === null || _a === void 0 ? void 0 : _a.length);
    }
    registerWindowListener(windowEventName, pluginEventName) {
      this.windowListeners[pluginEventName] = {
        registered: false,
        windowEventName,
        pluginEventName,
        handler: (event) => {
          this.notifyListeners(pluginEventName, event);
        }
      };
    }
    unimplemented(msg = "not implemented") {
      return new Capacitor.Exception(msg, ExceptionCode.Unimplemented);
    }
    unavailable(msg = "not available") {
      return new Capacitor.Exception(msg, ExceptionCode.Unavailable);
    }
    async removeListener(eventName, listenerFunc) {
      const listeners = this.listeners[eventName];
      if (!listeners) {
        return;
      }
      const index = listeners.indexOf(listenerFunc);
      if (index !== -1) {
        this.listeners[eventName].splice(index, 1);
      }
      if (!this.listeners[eventName].length) {
        this.removeWindowListener(this.windowListeners[eventName]);
      }
    }
    addWindowListener(handle) {
      window.addEventListener(handle.windowEventName, handle.handler);
      handle.registered = true;
    }
    removeWindowListener(handle) {
      if (!handle) {
        return;
      }
      window.removeEventListener(handle.windowEventName, handle.handler);
      handle.registered = false;
    }
    sendRetainedArgumentsForEvent(eventName) {
      const args = this.retainedEventArguments[eventName];
      if (!args) {
        return;
      }
      delete this.retainedEventArguments[eventName];
      args.forEach((arg) => {
        this.notifyListeners(eventName, arg);
      });
    }
  };
  var encode = (str) => encodeURIComponent(str).replace(/%(2[346B]|5E|60|7C)/g, decodeURIComponent).replace(/[()]/g, escape);
  var decode = (str) => str.replace(/(%[\dA-F]{2})+/gi, decodeURIComponent);
  var CapacitorCookiesPluginWeb = class extends WebPlugin {
    async getCookies() {
      const cookies = document.cookie;
      const cookieMap = {};
      cookies.split(";").forEach((cookie) => {
        if (cookie.length <= 0)
          return;
        let [key, value] = cookie.replace(/=/, "CAP_COOKIE").split("CAP_COOKIE");
        key = decode(key).trim();
        value = decode(value).trim();
        cookieMap[key] = value;
      });
      return cookieMap;
    }
    async setCookie(options) {
      try {
        const encodedKey = encode(options.key);
        const encodedValue = encode(options.value);
        const expires = options.expires ? `; expires=${options.expires.replace("expires=", "")}` : "";
        const path = (options.path || "/").replace("path=", "");
        const domain = options.url != null && options.url.length > 0 ? `domain=${options.url}` : "";
        document.cookie = `${encodedKey}=${encodedValue || ""}${expires}; path=${path}; ${domain};`;
      } catch (error) {
        return Promise.reject(error);
      }
    }
    async deleteCookie(options) {
      try {
        document.cookie = `${options.key}=; Max-Age=0`;
      } catch (error) {
        return Promise.reject(error);
      }
    }
    async clearCookies() {
      try {
        const cookies = document.cookie.split(";") || [];
        for (const cookie of cookies) {
          document.cookie = cookie.replace(/^ +/, "").replace(/=.*/, `=;expires=${(/* @__PURE__ */ new Date()).toUTCString()};path=/`);
        }
      } catch (error) {
        return Promise.reject(error);
      }
    }
    async clearAllCookies() {
      try {
        await this.clearCookies();
      } catch (error) {
        return Promise.reject(error);
      }
    }
  };
  var CapacitorCookies = registerPlugin("CapacitorCookies", {
    web: () => new CapacitorCookiesPluginWeb()
  });
  var readBlobAsBase64 = async (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64String = reader.result;
      resolve(base64String.indexOf(",") >= 0 ? base64String.split(",")[1] : base64String);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(blob);
  });
  var normalizeHttpHeaders = (headers = {}) => {
    const originalKeys = Object.keys(headers);
    const loweredKeys = Object.keys(headers).map((k) => k.toLocaleLowerCase());
    const normalized = loweredKeys.reduce((acc, key, index) => {
      acc[key] = headers[originalKeys[index]];
      return acc;
    }, {});
    return normalized;
  };
  var buildUrlParams = (params, shouldEncode = true) => {
    if (!params)
      return null;
    const output = Object.entries(params).reduce((accumulator, entry) => {
      const [key, value] = entry;
      let encodedValue;
      let item;
      if (Array.isArray(value)) {
        item = "";
        value.forEach((str) => {
          encodedValue = shouldEncode ? encodeURIComponent(str) : str;
          item += `${key}=${encodedValue}&`;
        });
        item.slice(0, -1);
      } else {
        encodedValue = shouldEncode ? encodeURIComponent(value) : value;
        item = `${key}=${encodedValue}`;
      }
      return `${accumulator}&${item}`;
    }, "");
    return output.substr(1);
  };
  var buildRequestInit = (options, extra = {}) => {
    const output = Object.assign({ method: options.method || "GET", headers: options.headers }, extra);
    const headers = normalizeHttpHeaders(options.headers);
    const type = headers["content-type"] || "";
    if (typeof options.data === "string") {
      output.body = options.data;
    } else if (type.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(options.data || {})) {
        params.set(key, value);
      }
      output.body = params.toString();
    } else if (type.includes("multipart/form-data") || options.data instanceof FormData) {
      const form = new FormData();
      if (options.data instanceof FormData) {
        options.data.forEach((value, key) => {
          form.append(key, value);
        });
      } else {
        for (const key of Object.keys(options.data)) {
          form.append(key, options.data[key]);
        }
      }
      output.body = form;
      const headers2 = new Headers(output.headers);
      headers2.delete("content-type");
      output.headers = headers2;
    } else if (type.includes("application/json") || typeof options.data === "object") {
      output.body = JSON.stringify(options.data);
    }
    return output;
  };
  var CapacitorHttpPluginWeb = class extends WebPlugin {
    /**
     * Perform an Http request given a set of options
     * @param options Options to build the HTTP request
     */
    async request(options) {
      const requestInit = buildRequestInit(options, options.webFetchExtra);
      const urlParams = buildUrlParams(options.params, options.shouldEncodeUrlParams);
      const url = urlParams ? `${options.url}?${urlParams}` : options.url;
      const response = await fetch(url, requestInit);
      const contentType = response.headers.get("content-type") || "";
      let { responseType = "text" } = response.ok ? options : {};
      if (contentType.includes("application/json")) {
        responseType = "json";
      }
      let data;
      let blob;
      switch (responseType) {
        case "arraybuffer":
        case "blob":
          blob = await response.blob();
          data = await readBlobAsBase64(blob);
          break;
        case "json":
          data = await response.json();
          break;
        case "document":
        case "text":
        default:
          data = await response.text();
      }
      const headers = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      return {
        data,
        headers,
        status: response.status,
        url: response.url
      };
    }
    /**
     * Perform an Http GET request given a set of options
     * @param options Options to build the HTTP request
     */
    async get(options) {
      return this.request(Object.assign(Object.assign({}, options), { method: "GET" }));
    }
    /**
     * Perform an Http POST request given a set of options
     * @param options Options to build the HTTP request
     */
    async post(options) {
      return this.request(Object.assign(Object.assign({}, options), { method: "POST" }));
    }
    /**
     * Perform an Http PUT request given a set of options
     * @param options Options to build the HTTP request
     */
    async put(options) {
      return this.request(Object.assign(Object.assign({}, options), { method: "PUT" }));
    }
    /**
     * Perform an Http PATCH request given a set of options
     * @param options Options to build the HTTP request
     */
    async patch(options) {
      return this.request(Object.assign(Object.assign({}, options), { method: "PATCH" }));
    }
    /**
     * Perform an Http DELETE request given a set of options
     * @param options Options to build the HTTP request
     */
    async delete(options) {
      return this.request(Object.assign(Object.assign({}, options), { method: "DELETE" }));
    }
  };
  var CapacitorHttp = registerPlugin("CapacitorHttp", {
    web: () => new CapacitorHttpPluginWeb()
  });
  var SystemBarsStyle;
  (function(SystemBarsStyle2) {
    SystemBarsStyle2["Dark"] = "DARK";
    SystemBarsStyle2["Light"] = "LIGHT";
    SystemBarsStyle2["Default"] = "DEFAULT";
  })(SystemBarsStyle || (SystemBarsStyle = {}));
  var SystemBarType;
  (function(SystemBarType2) {
    SystemBarType2["StatusBar"] = "StatusBar";
    SystemBarType2["NavigationBar"] = "NavigationBar";
  })(SystemBarType || (SystemBarType = {}));
  var SystemBarsPluginWeb = class extends WebPlugin {
    async setStyle() {
      this.unavailable("not available for web");
    }
    async setAnimation() {
      this.unavailable("not available for web");
    }
    async show() {
      this.unavailable("not available for web");
    }
    async hide() {
      this.unavailable("not available for web");
    }
  };
  var SystemBars = registerPlugin("SystemBars", {
    web: () => new SystemBarsPluginWeb()
  });

  // node_modules/@onesignal/capacitor-plugin/dist/index.js
  var Debug = class {
    constructor(plugin) {
      this._plugin = plugin;
    }
    /**
    * Enable logging to help debug if you run into an issue setting up OneSignal.
    * @param  {LogLevel} logLevel - Sets the logging level to print to the Android LogCat log or Xcode log.
    * @returns void
    */
    setLogLevel(logLevel) {
      this._plugin.setLogLevel({ logLevel });
    }
    /**
    * Enable logging to help debug if you run into an issue setting up OneSignal.
    * @param  {LogLevel} visualLogLevel - Sets the logging level to show as alert dialogs.
    * @returns void
    */
    setAlertLevel(visualLogLevel) {
      this._plugin.setAlertLevel({ logLevel: visualLogLevel });
    }
  };
  function removeListener(array, listener) {
    const index = array.indexOf(listener);
    if (index !== -1) array.splice(index, 1);
  }
  function isObjectSerializable(value) {
    if (!(typeof value === "object" && value !== null && !Array.isArray(value))) return false;
    try {
      JSON.stringify(value);
      return true;
    } catch {
      return false;
    }
  }
  var InAppMessages = class {
    constructor(plugin) {
      this._inAppMessageClickListeners = [];
      this._willDisplayInAppMessageListeners = [];
      this._didDisplayInAppMessageListeners = [];
      this._willDismissInAppMessageListeners = [];
      this._didDismissInAppMessageListeners = [];
      this._hasRegisteredClickListener = false;
      this._hasRegisteredWillDisplayListener = false;
      this._hasRegisteredDidDisplayListener = false;
      this._hasRegisteredWillDismissListener = false;
      this._hasRegisteredDidDismissListener = false;
      this._plugin = plugin;
    }
    _processFunctionList(array, param) {
      for (let i = 0; i < array.length; i++) array[i](param);
    }
    /**
    * Add event listeners for In-App Message click and/or lifecycle events.
    * Each native event channel is bridged once per namespace instance; subsequent
    * subscribers are appended to the local list. Without this guard, hot-reload
    * cycles and effect re-runs leak orphaned bridge subscriptions that fan a
    * single native event into N JS callbacks.
    */
    addEventListener(event, listener) {
      if (event === "click") {
        this._inAppMessageClickListeners.push(listener);
        if (!this._hasRegisteredClickListener) {
          this._hasRegisteredClickListener = true;
          this._plugin.addListener("inAppMessageClick", (json) => {
            this._processFunctionList(this._inAppMessageClickListeners, json);
          });
        }
      } else if (event === "willDisplay") {
        this._willDisplayInAppMessageListeners.push(listener);
        if (!this._hasRegisteredWillDisplayListener) {
          this._hasRegisteredWillDisplayListener = true;
          this._plugin.addListener("inAppMessageWillDisplay", (event2) => {
            this._processFunctionList(this._willDisplayInAppMessageListeners, event2);
          });
        }
      } else if (event === "didDisplay") {
        this._didDisplayInAppMessageListeners.push(listener);
        if (!this._hasRegisteredDidDisplayListener) {
          this._hasRegisteredDidDisplayListener = true;
          this._plugin.addListener("inAppMessageDidDisplay", (event2) => {
            this._processFunctionList(this._didDisplayInAppMessageListeners, event2);
          });
        }
      } else if (event === "willDismiss") {
        this._willDismissInAppMessageListeners.push(listener);
        if (!this._hasRegisteredWillDismissListener) {
          this._hasRegisteredWillDismissListener = true;
          this._plugin.addListener("inAppMessageWillDismiss", (event2) => {
            this._processFunctionList(this._willDismissInAppMessageListeners, event2);
          });
        }
      } else if (event === "didDismiss") {
        this._didDismissInAppMessageListeners.push(listener);
        if (!this._hasRegisteredDidDismissListener) {
          this._hasRegisteredDidDismissListener = true;
          this._plugin.addListener("inAppMessageDidDismiss", (event2) => {
            this._processFunctionList(this._didDismissInAppMessageListeners, event2);
          });
        }
      }
    }
    /**
    * Remove event listeners for In-App Message click and/or lifecycle events.
    * @param event
    * @param listener
    * @returns
    */
    removeEventListener(event, listener) {
      if (event === "click") removeListener(this._inAppMessageClickListeners, listener);
      else if (event === "willDisplay") removeListener(this._willDisplayInAppMessageListeners, listener);
      else if (event === "didDisplay") removeListener(this._didDisplayInAppMessageListeners, listener);
      else if (event === "willDismiss") removeListener(this._willDismissInAppMessageListeners, listener);
      else if (event === "didDismiss") removeListener(this._didDismissInAppMessageListeners, listener);
    }
    /**
    * Add a trigger for the current user. Triggers are currently explicitly used to determine whether a specific IAM should be displayed to the user.
    * @param  {string} key
    * @param  {string} value
    * @returns Promise<void>
    */
    addTrigger(key, value) {
      return this.addTriggers({ [key]: value });
    }
    /**
    * Add multiple triggers for the current user.
    * @param  {[key: string]: string} triggers
    * @returns Promise<void>
    */
    addTriggers(triggers) {
      Object.keys(triggers).forEach(function(key) {
        if (typeof triggers[key] !== "string") triggers[key] = JSON.stringify(triggers[key]);
      });
      return this._plugin.addTriggers({ triggers });
    }
    /**
    * Remove the trigger with the provided key from the current user.
    * @param  {string} key
    * @returns Promise<void>
    */
    removeTrigger(key) {
      return this.removeTriggers([key]);
    }
    /**
    * Remove multiple triggers from the current user.
    * @param  {string[]} keys
    * @returns Promise<void>
    */
    removeTriggers(keys) {
      if (!Array.isArray(keys)) console.error("OneSignal: removeTriggers: argument must be of type Array");
      return this._plugin.removeTriggers({ keys });
    }
    /**
    * Clear all triggers from the current user.
    * @returns Promise<void>
    */
    clearTriggers() {
      return this._plugin.clearTriggers();
    }
    /**
    * Set whether in-app messaging is currently paused.
    * @param  {boolean} pause
    * @returns void
    */
    setPaused(pause) {
      this._plugin.setPaused({ pause });
    }
    /**
    * Whether in-app messaging is currently paused.
    * @returns {Promise<boolean>}
    */
    async getPaused() {
      return (await this._plugin.isPaused()).paused;
    }
  };
  var LiveActivities = class {
    constructor(plugin) {
      this._plugin = plugin;
    }
    /**
    * Enter a live activity
    * @param  {string} activityId
    * @param  {string} token
    * @param  {Function} onSuccess
    * @param  {Function} onFailure
    * @returns void
    */
    enter(activityId, token, onSuccess, onFailure) {
      this._plugin.enterLiveActivity({
        activityId,
        token
      }).then((result) => {
        onSuccess?.(result);
      }).catch((error) => {
        onFailure?.(error);
      });
    }
    /**
    * Exit a live activity
    * @param  {string} activityId
    * @param  {Function} onSuccess
    * @param  {Function} onFailure
    * @returns void
    * @deprecated Currently unsupported, avoid using this method.
    */
    exit(activityId, onSuccess, onFailure) {
      this._plugin.exitLiveActivity({ activityId }).then((result) => {
        onSuccess?.(result);
      }).catch((error) => {
        onFailure?.(error);
      });
    }
    /**
    * Indicate this device is capable of receiving pushToStart live activities for the
    * `activityType`. Only applies to iOS.
    * @param {string} activityType
    * @param {string} token
    */
    setPushToStartToken(activityType, token) {
      return this._plugin.setPushToStartToken({
        activityType,
        token
      });
    }
    /**
    * Indicate this device is no longer capable of receiving pushToStart live activities
    * for the `activityType`. Only applies to iOS.
    * @param {string} activityType
    */
    removePushToStartToken(activityType) {
      return this._plugin.removePushToStartToken({ activityType });
    }
    /**
    * Enable the OneSignalSDK to setup the default `DefaultLiveActivityAttributes` structure.
    * Only applies to iOS.
    * @param {LiveActivitySetupOptions} options
    */
    setupDefault(options) {
      return this._plugin.setupDefaultLiveActivity(options);
    }
    /**
    * Start a new LiveActivity that is modelled by the default `DefaultLiveActivityAttributes`
    * structure. Only applies to iOS.
    * @param {string} activityId
    * @param {object} attributes
    * @param {object} content
    */
    startDefault(activityId, attributes, content) {
      return this._plugin.startDefaultLiveActivity({
        activityId,
        attributes,
        content
      });
    }
  };
  var Location = class {
    constructor(plugin) {
      this._plugin = plugin;
    }
    /**
    * Prompts the user for location permissions to allow geotagging from the OneSignal dashboard.
    * @returns Promise<void>
    */
    requestPermission() {
      return this._plugin.requestLocationPermission();
    }
    /**
    * Disable or enable location collection (defaults to enabled if your app has location permission).
    * @param  {boolean} shared
    * @returns void
    */
    setShared(shared) {
      this._plugin.setLocationShared({ shared });
    }
    /**
    * Whether location is currently shared with OneSignal.
    * @returns {Promise<boolean>}
    */
    async isShared() {
      return (await this._plugin.isLocationShared()).shared;
    }
  };
  var _pluginRef$1;
  function _setOSNotificationPlugin(plugin) {
    _pluginRef$1 = plugin;
  }
  var OSNotification = class {
    constructor(receivedEvent) {
      this.notificationId = receivedEvent.notificationId;
      this.body = receivedEvent.body;
      this.title = receivedEvent.title;
      this.additionalData = receivedEvent.additionalData;
      if (typeof receivedEvent.rawPayload === "string") this.rawPayload = JSON.parse(receivedEvent.rawPayload);
      else this.rawPayload = receivedEvent.rawPayload;
      this.launchURL = receivedEvent.launchURL;
      this.sound = receivedEvent.sound;
      if (receivedEvent.actionButtons) this.actionButtons = receivedEvent.actionButtons;
      if (receivedEvent.groupKey) this.groupKey = receivedEvent.groupKey;
      if (receivedEvent.ledColor) this.ledColor = receivedEvent.ledColor;
      if (typeof receivedEvent.priority !== "undefined") this.priority = receivedEvent.priority;
      if (receivedEvent.smallIcon) this.smallIcon = receivedEvent.smallIcon;
      if (receivedEvent.largeIcon) this.largeIcon = receivedEvent.largeIcon;
      if (receivedEvent.bigPicture) this.bigPicture = receivedEvent.bigPicture;
      if (receivedEvent.collapseId) this.collapseId = receivedEvent.collapseId;
      if (receivedEvent.groupMessage) this.groupMessage = receivedEvent.groupMessage;
      if (receivedEvent.fromProjectNumber) this.fromProjectNumber = receivedEvent.fromProjectNumber;
      if (receivedEvent.smallIconAccentColor) this.smallIconAccentColor = receivedEvent.smallIconAccentColor;
      if (typeof receivedEvent.lockScreenVisibility !== "undefined") this.lockScreenVisibility = receivedEvent.lockScreenVisibility;
      if (typeof receivedEvent.androidNotificationId !== "undefined") this.androidNotificationId = receivedEvent.androidNotificationId;
      if (receivedEvent.groupedNotifications) this.groupedNotifications = receivedEvent.groupedNotifications;
      if (receivedEvent.badge) this.badge = receivedEvent.badge;
      if (receivedEvent.category) this.category = receivedEvent.category;
      if (receivedEvent.threadId) this.threadId = receivedEvent.threadId;
      if (receivedEvent.subtitle) this.subtitle = receivedEvent.subtitle;
      if (receivedEvent.templateId) this.templateId = receivedEvent.templateId;
      if (receivedEvent.attachments) this.attachments = receivedEvent.attachments;
      if (receivedEvent.templateName) this.templateName = receivedEvent.templateName;
      if (receivedEvent.mutableContent) this.mutableContent = receivedEvent.mutableContent;
      if (receivedEvent.badgeIncrement) this.badgeIncrement = receivedEvent.badgeIncrement;
      if (receivedEvent.contentAvailable) this.contentAvailable = receivedEvent.contentAvailable;
      if (receivedEvent.relevanceScore) this.relevanceScore = receivedEvent.relevanceScore;
      if (receivedEvent.interruptionLevel) this.interruptionLevel = receivedEvent.interruptionLevel;
    }
    /**
    * Display the notification.
    * @returns void
    */
    display() {
      if (_pluginRef$1) _pluginRef$1.displayNotification({ notificationId: this.notificationId });
    }
  };
  var _pluginRef;
  function _setNotificationEventPlugin(plugin) {
    _pluginRef = plugin;
  }
  var NotificationWillDisplayEvent = class {
    constructor(displayEvent) {
      this.notification = new OSNotification(displayEvent);
    }
    /**
    * Call this to prevent OneSignal from displaying the notification automatically.
    * This method can be called up to two times with false and then true, if processing time is needed.
    * Typically this is only possible within a short
    * time-frame (~25 seconds) after the notification is received on the device.
    * @param discard an [preventDefault] set to true to dismiss the notification with no
    * possibility of displaying it in the future.
    */
    preventDefault(discard = false) {
      if (_pluginRef) _pluginRef.preventDefault({
        notificationId: this.notification.notificationId,
        discard
      });
    }
    getNotification() {
      return this.notification;
    }
  };
  var Notifications = class {
    constructor(plugin) {
      this._permissionObserverList = [];
      this._notificationClickedListeners = [];
      this._notificationWillDisplayListeners = [];
      this._hasRegisteredClickListener = false;
      this._hasRegisteredForegroundWillDisplayListener = false;
      this._hasRegisteredPermissionListener = false;
      this._plugin = plugin;
    }
    _processFunctionList(array, param) {
      for (let i = 0; i < array.length; i++) array[i](param);
    }
    /**
    * Whether this app has push notification permission. Returns true if the user has accepted permissions,
    * or if the app has ephemeral or provisional permission.
    */
    async hasPermission() {
      return (await this._plugin.getPermission()).permission;
    }
    /**
    * iOS Only.
    * Returns the native permission of the device.
    * @returns {Promise<OSNotificationPermission>}
    */
    async permissionNative() {
      return (await this._plugin.permissionNative()).permission;
    }
    /**
    * Prompt the user for permission to receive push notifications.
    * Use the fallbackToSettings parameter to prompt to open the settings app if a user has already declined push permissions.
    * @param  {boolean} fallbackToSettings
    * @returns {Promise<boolean>}
    */
    async requestPermission(fallbackToSettings) {
      const fallback = fallbackToSettings ?? false;
      return (await this._plugin.requestPermission({ fallbackToSettings: fallback })).permission;
    }
    /**
    * Whether attempting to request notification permission will show a prompt.
    * Returns true if the device has not been prompted for push notification permission already.
    * @returns {Promise<boolean>}
    */
    async canRequestPermission() {
      return (await this._plugin.canRequestPermission()).canRequest;
    }
    /**
    * iOS Only.
    * Instead of having to prompt the user for permission to send them push notifications,
    * your app can request provisional authorization.
    * @param  {(response: boolean)=>void} handler
    * @returns void
    */
    registerForProvisionalAuthorization(handler) {
      this._plugin.registerForProvisionalAuthorization().then((result) => {
        handler?.(result.accepted);
      });
    }
    /**
    * Add listeners for notification events.
    * @param event
    * @param listener
    * @returns
    */
    addEventListener(event, listener) {
      if (event === "click") {
        this._notificationClickedListeners.push(listener);
        if (!this._hasRegisteredClickListener) {
          this._hasRegisteredClickListener = true;
          this._plugin.addListener("notificationClick", (json) => {
            if (this._notificationClickedListeners.length === 0) return;
            this._processFunctionList(this._notificationClickedListeners, {
              ...json,
              notification: new OSNotification(json.notification)
            });
          });
        }
      } else if (event === "foregroundWillDisplay") {
        this._notificationWillDisplayListeners.push(listener);
        if (!this._hasRegisteredForegroundWillDisplayListener) {
          this._hasRegisteredForegroundWillDisplayListener = true;
          this._foregroundWillDisplayListenerHandle = this._plugin.addListener("notificationForegroundWillDisplay", (notification) => {
            this._notificationWillDisplayListeners.forEach((listener2) => {
              listener2(new NotificationWillDisplayEvent(notification));
            });
            this._plugin.proceedWithWillDisplay({ notificationId: notification.notificationId });
          });
        }
      } else if (event === "permissionChange") {
        this._permissionObserverList.push(listener);
        if (!this._hasRegisteredPermissionListener) {
          this._hasRegisteredPermissionListener = true;
          this._plugin.addListener("permissionChange", (state) => {
            this._processFunctionList(this._permissionObserverList, state.permission);
          });
        }
      }
    }
    /**
    * Remove listeners for notification events.
    * @param event
    * @param listener
    * @returns
    */
    removeEventListener(event, listener) {
      if (event === "click") removeListener(this._notificationClickedListeners, listener);
      else if (event === "foregroundWillDisplay") {
        removeListener(this._notificationWillDisplayListeners, listener);
        if (this._notificationWillDisplayListeners.length === 0) {
          this._hasRegisteredForegroundWillDisplayListener = false;
          const listenerHandle = this._foregroundWillDisplayListenerHandle;
          this._foregroundWillDisplayListenerHandle = void 0;
          listenerHandle?.then((handle) => handle.remove());
        }
      } else if (event === "permissionChange") removeListener(this._permissionObserverList, listener);
    }
    /**
    * Removes all OneSignal notifications.
    * @returns Promise<void>
    */
    clearAll() {
      return this._plugin.clearAllNotifications();
    }
    /**
    * Android only.
    * Cancels a single OneSignal notification based on its Android notification integer ID.
    * @param  {number} id - notification id to cancel
    * @returns Promise<void>
    */
    removeNotification(id) {
      return this._plugin.removeNotification({ id });
    }
    /**
    * Android only.
    * Cancels a group of OneSignal notifications with the provided group key.
    * @param  {string} id - notification group id to cancel
    * @returns Promise<void>
    */
    removeGroupedNotifications(id) {
      return this._plugin.removeGroupedNotifications({ id });
    }
  };
  var Session = class {
    constructor(plugin) {
      this._plugin = plugin;
    }
    /**
    * Add an outcome with the provided name, captured against the current session.
    * @param  {string} name
    * @returns Promise<void>
    */
    addOutcome(name) {
      return this._plugin.addOutcome({ name });
    }
    /**
    * Add a unique outcome with the provided name, captured against the current session.
    * @param  {string} name
    * @returns Promise<void>
    */
    addUniqueOutcome(name) {
      return this._plugin.addUniqueOutcome({ name });
    }
    /**
    * Add an outcome with the provided name and value, captured against the current session.
    * @param  {string} name
    * @param  {number} value
    * @returns Promise<void>
    */
    addOutcomeWithValue(name, value) {
      return this._plugin.addOutcomeWithValue({
        name,
        value
      });
    }
  };
  var PushSubscription = class {
    constructor(plugin) {
      this._subscriptionObserverList = [];
      this._hasRegisteredChangeListener = false;
      this._plugin = plugin;
    }
    _processFunctionList(array, param) {
      for (let i = 0; i < array.length; i++) array[i](param);
    }
    /**
    * The readonly push subscription ID.
    * @returns {Promise<string | null>}
    */
    async getIdAsync() {
      return (await this._plugin.getPushSubscriptionId()).id;
    }
    /**
    * The readonly push token.
    * @returns {Promise<string | null>}
    */
    async getTokenAsync() {
      return (await this._plugin.getPushSubscriptionToken()).token;
    }
    /**
    * Gets a boolean value indicating whether the current user is opted in to push notifications.
    * This returns true when the app has notifications permission and optOut() is NOT called.
    * Note: Does not take into account the existence of the subscription ID and push token.
    * This boolean may return true but push notifications may still not be received by the user.
    * @returns {Promise<boolean>}
    */
    async getOptedInAsync() {
      return (await this._plugin.getPushSubscriptionOptedIn()).optedIn;
    }
    /**
    * Add a callback that fires when the OneSignal push subscription state changes.
    * The bridge subscription is registered once per namespace instance; subsequent
    * subscribers append to the local list to avoid orphaned bridge handlers
    * across hot-reload cycles.
    */
    addEventListener(_event, listener) {
      this._subscriptionObserverList.push(listener);
      if (!this._hasRegisteredChangeListener) {
        this._hasRegisteredChangeListener = true;
        this._plugin.addListener("pushSubscriptionChange", (state) => {
          this._processFunctionList(this._subscriptionObserverList, state);
        });
      }
    }
    /**
    * Remove a push subscription observer that has been previously added.
    * @param  {(event: PushSubscriptionChangedState)=>void} listener
    * @returns void
    */
    removeEventListener(_event, listener) {
      removeListener(this._subscriptionObserverList, listener);
    }
    /**
    * Call this method to receive push notifications on the device or to resume receiving of push notifications after calling optOut. If needed, this method will prompt the user for push notifications permission.
    * @returns Promise<void>
    */
    optIn() {
      return this._plugin.optInPushSubscription();
    }
    /**
    * If at any point you want the user to stop receiving push notifications on the current device (regardless of system-level permission status), you can call this method to opt out.
    * @returns Promise<void>
    */
    optOut() {
      return this._plugin.optOutPushSubscription();
    }
  };
  var User = class {
    constructor(plugin) {
      this._userStateObserverList = [];
      this._hasRegisteredChangeListener = false;
      this._plugin = plugin;
      this.pushSubscription = new PushSubscription(plugin);
    }
    _processFunctionList(array, param) {
      for (let i = 0; i < array.length; i++) array[i](param);
    }
    /**
    * Explicitly set a 2-character language code for the user.
    * @param  {string} language
    * @returns Promise<void>
    */
    setLanguage(language) {
      return this._plugin.setLanguage({ language });
    }
    /**
    * Set an alias for the current user. If this alias label already exists on this user, it will be overwritten with the new alias id.
    * @param  {string} label
    * @param  {string} id
    * @returns Promise<void>
    */
    addAlias(label, id) {
      return this._plugin.addAliases({ aliases: { [label]: id } });
    }
    /**
    * Set aliases for the current user. If any alias already exists, it will be overwritten to the new values.
    * @param {object} aliases
    * @returns Promise<void>
    */
    addAliases(aliases) {
      return this._plugin.addAliases({ aliases });
    }
    /**
    * Remove an alias from the current user.
    * @param  {string} label
    * @returns Promise<void>
    */
    removeAlias(label) {
      return this._plugin.removeAliases({ labels: [label] });
    }
    /**
    * Remove aliases from the current user.
    * @param  {string[]} labels
    * @returns Promise<void>
    */
    removeAliases(labels) {
      return this._plugin.removeAliases({ labels });
    }
    /**
    * Add a new email subscription to the current user.
    * @param  {string} email
    * @returns Promise<void>
    */
    addEmail(email) {
      return this._plugin.addEmail({ email });
    }
    /**
    * Remove an email subscription from the current user.
    * @param {string} email
    * @returns Promise<void>
    */
    removeEmail(email) {
      return this._plugin.removeEmail({ email });
    }
    /**
    * Add a new SMS subscription to the current user.
    * @param  {string} smsNumber
    * @returns Promise<void>
    */
    addSms(smsNumber) {
      return this._plugin.addSms({ smsNumber });
    }
    /**
    * Remove an SMS subscription from the current user.
    * @param {string} smsNumber
    * @returns Promise<void>
    */
    removeSms(smsNumber) {
      return this._plugin.removeSms({ smsNumber });
    }
    /**
    * Add a tag for the current user. Tags are key:value string pairs used as building blocks for targeting specific users and/or personalizing messages.
    * @param  {string} key
    * @param  {string} value
    * @returns Promise<void>
    */
    addTag(key, value) {
      return this._plugin.addTags({ tags: { [key]: value } });
    }
    /**
    * Add multiple tags for the current user. Tags are key:value string pairs used as building blocks for targeting specific users and/or personalizing messages.
    * @param  {object} tags
    * @returns Promise<void>
    */
    addTags(tags) {
      const convertedTags = tags;
      Object.keys(tags).forEach(function(key) {
        if (typeof convertedTags[key] !== "string") convertedTags[key] = JSON.stringify(convertedTags[key]);
      });
      return this._plugin.addTags({ tags: convertedTags });
    }
    /**
    * Remove the data tag with the provided key from the current user.
    * @param  {string} key
    * @returns Promise<void>
    */
    removeTag(key) {
      return this._plugin.removeTags({ keys: [key] });
    }
    /**
    * Remove multiple tags with the provided keys from the current user.
    * @param  {string[]} keys
    * @returns Promise<void>
    */
    removeTags(keys) {
      return this._plugin.removeTags({ keys });
    }
    /**
    * Returns the local tags for the current user.
    * @returns Promise<{ [key: string]: string }>
    */
    async getTags() {
      return (await this._plugin.getTags()).tags;
    }
    /**
    * Add a callback that fires when the OneSignal User state changes.
    * The bridge subscription is registered once per namespace instance; subsequent
    * subscribers append to the local list to avoid orphaned bridge handlers
    * across hot-reload cycles.
    */
    addEventListener(_event, listener) {
      this._userStateObserverList.push(listener);
      if (!this._hasRegisteredChangeListener) {
        this._hasRegisteredChangeListener = true;
        this._plugin.addListener("userStateChange", (state) => {
          this._processFunctionList(this._userStateObserverList, state);
        });
      }
    }
    /**
    * Remove a User State observer that has been previously added.
    * @param  {(event: UserChangedState)=>void} listener
    * @returns void
    */
    removeEventListener(_event, listener) {
      removeListener(this._userStateObserverList, listener);
    }
    /**
    * Get the nullable OneSignal Id associated with the current user.
    * @returns {Promise<string | null>}
    */
    async getOnesignalId() {
      return (await this._plugin.getOnesignalId()).onesignalId;
    }
    /**
    * Get the nullable External Id associated with the current user.
    * @returns {Promise<string | null>}
    */
    async getExternalId() {
      return (await this._plugin.getExternalId()).externalId;
    }
    /**
    * Track a custom event with the provided name and optional properties.
    * @param  {string} name - The name of the custom event
    * @param  {object} [properties] - Optional properties to associate with the event
    * @returns Promise<void>
    */
    trackEvent(name, properties) {
      if (properties !== void 0 && !isObjectSerializable(properties)) {
        console.error("Properties must be a JSON-serializable object");
        return Promise.resolve();
      }
      return this._plugin.trackEvent({
        name,
        properties
      });
    }
  };
  var OneSignalPlugin = class {
    constructor(plugin) {
      this._appID = "";
      this._plugin = plugin;
      _setOSNotificationPlugin(plugin);
      _setNotificationEventPlugin(plugin);
      this.User = new User(plugin);
      this.Debug = new Debug(plugin);
      this.Session = new Session(plugin);
      this.Location = new Location(plugin);
      this.InAppMessages = new InAppMessages(plugin);
      this.Notifications = new Notifications(plugin);
      this.LiveActivities = new LiveActivities(plugin);
    }
    /**
    * Initializes the OneSignal SDK. This should be called during startup of the application.
    * @param  {string} appId
    * @returns Promise<void>
    */
    initialize(appId) {
      this._appID = appId;
      return this._plugin.initialize({ appId: this._appID });
    }
    /**
    * Login to OneSignal under the user identified by the [externalId] provided. The act of logging a user into the OneSignal SDK will switch the [user] context to that specific user.
    * @param  {string} externalId
    * @returns Promise<void>
    */
    login(externalId) {
      return this._plugin.login({ externalId });
    }
    /**
    * Logout the user previously logged in via [login]. The [user] property now references a new device-scoped user.
    * @returns Promise<void>
    */
    logout() {
      return this._plugin.logout();
    }
    /**
    * Determines whether a user must consent to privacy prior to their user data being sent up to OneSignal. This should be set to true prior to the invocation of initialization to ensure compliance.
    * @param  {boolean} required
    * @returns void
    */
    setConsentRequired(required) {
      this._plugin.setConsentRequired({ required });
    }
    /**
    * Indicates whether privacy consent has been granted. This field is only relevant when the application has opted into data privacy protections.
    * @param  {boolean} granted
    * @returns void
    */
    setConsentGiven(granted) {
      this._plugin.setConsentGiven({ granted });
    }
  };
  var OneSignal = new OneSignalPlugin(registerPlugin("OneSignalCapacitor"));

  // src/mobile-push.js
  var ONESIGNAL_APP_ID = "37313947-2360-4bf3-ab26-21310fced263";
  async function getPushDiagnostics() {
    const permission = await OneSignal.Notifications.hasPermission();
    let oneSignalId = null;
    let subscriptionId = null;
    let optedIn = null;
    try {
      oneSignalId = await OneSignal.User.getOnesignalId();
    } catch (error) {
      console.warn("OneSignal ID check failed:", error);
    }
    try {
      subscriptionId = await OneSignal.User.pushSubscription.getIdAsync();
    } catch (error) {
      console.warn("Subscription ID check failed:", error);
    }
    try {
      optedIn = await OneSignal.User.pushSubscription.getOptedInAsync();
    } catch (error) {
      console.warn("Opt-in check failed:", error);
    }
    return {
      permission,
      oneSignalId,
      subscriptionId,
      optedIn
    };
  }
  async function startMobilePush() {
    const button = document.getElementById("enable-fcm-btn");
    if (!button) {
      throw new Error("Notification button missing");
    }
    if (!Capacitor.isNativePlatform()) {
      button.textContent = "Open the APK to enable mobile alerts";
      button.disabled = true;
      return;
    }
    button.disabled = true;
    button.textContent = "Preparing notifications...";
    await OneSignal.initialize(ONESIGNAL_APP_ID);
    window.rudolfMobilePush = OneSignal;
    button.disabled = false;
    button.textContent = "🔔";
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await OneSignal.Notifications.requestPermission(true);
        const result = await getPushDiagnostics();
        console.log("RUDOLF NATIVE PUSH DIAGNOSTIC:", result);
        button.textContent = result.permission && result.subscriptionId ? "\u2705 Mobile Alerts Ready" : "\u26A0\uFE0F Check Notifications";
        alert(
          "RUDOLF RIDE NATIVE PUSH\n\nPermission: " + result.permission + "\nOpted In: " + result.optedIn + "\nOneSignal ID: " + (result.oneSignalId || "NOT READY") + "\nSubscription ID: " + (result.subscriptionId || "NOT READY")
        );
      } catch (error) {
        console.error("Notification setup failed:", error);
        button.textContent = "Retry Notifications";
        alert(
          "Notification setup failed:\n\n" + (error?.message || String(error))
        );
      } finally {
        button.disabled = false;
      }
    });
  }
  startMobilePush().catch((error) => {
    console.error("Mobile push setup:", error);
    const button = document.getElementById("enable-fcm-btn");
    if (button) {
      button.textContent = "Notification setup failed";
    }
    alert(
      "Mobile push setup failed:\n\n" + (error?.message || String(error))
    );
  });
})();
/*! Bundled license information:

@capacitor/core/dist/index.js:
  (*! Capacitor: https://capacitorjs.com/ - MIT License *)
*/
