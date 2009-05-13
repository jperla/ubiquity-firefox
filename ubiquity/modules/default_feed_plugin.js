/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Ubiquity.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Atul Varma <atul@mozilla.com>
 *   Jono DiCarlo <jdicarlo@mozilla.com>
 *   Blair McBride <unfocused@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

let EXPORTED_SYMBOLS = ["DefaultFeedPlugin"];

Components.utils.import("resource://ubiquity/modules/utils.js");
Components.utils.import("resource://ubiquity/modules/codesource.js");
Components.utils.import("resource://ubiquity/modules/sandboxfactory.js");
Components.utils.import("resource://ubiquity/modules/collection.js");
Components.utils.import("resource://ubiquity/modules/feed_plugin_utils.js");

const CONFIRM_URL = "chrome://ubiquity/content/confirm-add-command.html";
const DEFAULT_FEED_TYPE = "commands";
const TRUSTED_DOMAINS_PREF = "extensions.ubiquity.trustedDomains";
const REMOTE_URI_TIMEOUT_PREF = "extensions.ubiquity.remoteUriTimeout";

function DefaultFeedPlugin(feedManager, messageService, webJsm,
                           languageCode, baseUri, parserVersion) {
  this.type = DEFAULT_FEED_TYPE;

  let Application = Components.classes["@mozilla.org/fuel/application;1"]
                    .getService(Components.interfaces.fuelIApplication);

  let builtins = makeBuiltins(languageCode, baseUri, parserVersion);
  let builtinGlobalsMaker = makeBuiltinGlobalsMaker(messageService,
                                                    webJsm);
  let sandboxFactory = new SandboxFactory(builtinGlobalsMaker);

  builtins.feeds.forEach(
    function addFeed(url) {
      feedManager.addSubscribedFeed({url: url,
                                     sourceUrl: url,
                                     canAutoUpdate: true,
                                     isBuiltIn: true});
    }
  );

  this.installDefaults = function DFP_installDefaults(baseUri,
                                                      baseLocalUri,
                                                      infos) {
    for (let i = 0; i < infos.length; i++) {
      let info = infos[i];
      let uri = Utils.url(baseUri + info.page);

      if (!feedManager.isUnsubscribedFeed(uri)) {
        let lcs = new LocalUriCodeSource(baseLocalUri + info.source);
        feedManager.addSubscribedFeed({url: uri,
                                       sourceUrl: baseUri + info.source,
                                       sourceCode: lcs.getCode(),
                                       canAutoUpdate: true,
                                       title: info.title});
      }
    }
  };

  this.onSubscribeClick = function DFP_onSubscribeClick(targetDoc,
                                                        commandsUrl,
                                                        mimetype) {
    // Clicking on "subscribe" takes them to the warning page:
    var confirmUrl = (CONFIRM_URL + "?url=" +
                      encodeURIComponent(targetDoc.location.href) +
                      "&sourceUrl=" + encodeURIComponent(commandsUrl) +
                      "&title=" + encodeURIComponent(targetDoc.title));

    function isTrustedUrl(commandsUrl, mimetype) {
      // Even if the command feed resides on a trusted host, if the
      // mime-type is application/x-javascript-untrusted or
      // application/xhtml+xml-untrusted, the host itself doesn't
      // trust it (perhaps because it's mirroring code from
      // somewhere else).
      if (mimetype == "application/x-javascript-untrusted" ||
          mimetype == "application/xhtml+xml-untrusted")
        return false;

      var url = Utils.url(commandsUrl);

      if (url.scheme != "https")
        return false;

      var domains = Application.prefs.getValue(TRUSTED_DOMAINS_PREF, "");
      domains = domains.split(",");

      for (var i = 0; i < domains.length; i++) {
        if (domains[i] == url.host)
          return true;
      }

      return false;
    }

    if (isTrustedUrl(commandsUrl, mimetype)) {
      function onSuccess(data) {
        feedManager.addSubscribedFeed({url: targetDoc.location.href,
                                       sourceUrl: commandsUrl,
                                       canAutoUpdate: true,
                                       sourceCode: data});
        Utils.openUrlInBrowser(confirmUrl);
      }

      if (RemoteUriCodeSource.isValidUri(commandsUrl)) {
        webJsm.jQuery.ajax({url: commandsUrl,
                            dataType: "text",
                            success: onSuccess});
      } else
        onSuccess("");
    } else
      Utils.openUrlInBrowser(confirmUrl);
  };

  this.makeFeed = function DFP_makeFeed(baseFeedInfo, hub) {
    var timeout = Application.prefs.getValue(REMOTE_URI_TIMEOUT_PREF, 10);
    return new DFPFeed(baseFeedInfo, hub, messageService, sandboxFactory,
                       builtins.headers, builtins.footers,
                       webJsm.jQuery, timeout);
  };

  feedManager.registerPlugin(this);
}

const CMD_PREFIX = "cmd_";
const NOUN_PREFIX = "noun_";

function makeCmdForObj(sandbox, objName) {
  var cmdName = objName.substr(CMD_PREFIX.length);
  cmdName = cmdName.replace(/_/g, "-");
  var cmdFunc = sandbox[objName];

  var cmd = {
    name : cmdName,
    icon : cmdFunc.icon,
    execute : function CS_execute(context, directObject, modifiers) {
      sandbox.context = context;
      return cmdFunc(directObject, modifiers);
    }
  };
  
  if (cmdFunc.preview) {
    cmd.preview = function CS_preview(context, previewBlock, directObject,
                                      modifiers) {
      sandbox.context = context;
      return cmdFunc.preview(previewBlock, directObject,
                             modifiers);
    };
  }

  cmd.__proto__ = cmdFunc;

  // if it doesn't take any arguments
  if ((cmd.DOLabel == undefined) && (cmd.modifiers == undefined)) {
    // enable use in parser 2
    cmd.names = { en: [ cmdName ] };
    cmd.arguments = [];
  }

  return finishCommand(cmd);
};

function makeCodeSource(feedInfo, headerSources, footerSources,
                        timeoutInterval) {
  var codeSource;

  if (RemoteUriCodeSource.isValidUri(feedInfo.srcUri)) {
    if (feedInfo.canAutoUpdate) {
      codeSource = new RemoteUriCodeSource(feedInfo, timeoutInterval);
    } else
      codeSource = new StringCodeSource(feedInfo.getCode(),
                                        feedInfo.srcUri.spec);
  } else if (LocalUriCodeSource.isValidUri(feedInfo.srcUri)) {
    codeSource = new LocalUriCodeSource(feedInfo.srcUri.spec);
  } else {
    throw new Error("Don't know how to make code source for " +
                    feedInfo.srcUri.spec);
  }

  codeSource = new XhtmlCodeSource(codeSource);

  codeSource = new MixedCodeSource(codeSource,
                                   headerSources,
                                   footerSources);

  return codeSource;
}

function DFPFeed(feedInfo, hub, messageService, sandboxFactory,
                 headerSources, footerSources, jQuery, timeoutInterval) {
  if (LocalUriCodeSource.isValidUri(feedInfo.srcUri))
    this.canAutoUpdate = true;

  let codeSource = makeCodeSource(feedInfo, headerSources, footerSources,
                                  timeoutInterval);

  var codeCache = null;
  var sandbox = null;

  let self = this;

  function reset() {
    self.nounTypes = [];
    self.commands = [];
    self.pageLoadFuncs = [];
  }

  reset();

  this.refresh = function refresh() {
    let code = codeSource.getCode();
    if (code != codeCache) {
      reset();
      codeCache = code;
      sandbox = sandboxFactory.makeSandbox(codeSource);
      try {
        sandboxFactory.evalInSandbox(code,
                                     sandbox,
                                     codeSource.codeSections);
      } catch (e) {
        messageService.displayMessage(
          {text:  "An exception occurred while loading code.",
           exception: e}
        );
      }

      for (var objName in sandbox) {
        if (objName.indexOf(CMD_PREFIX) == 0) {
          var cmd = makeCmdForObj(sandbox, objName);

          this.commands[cmd.name] = cmd;
        }
        if (objName.indexOf(NOUN_PREFIX) == 0)
          this.nounTypes.push(sandbox[objName]);
      }

      this.pageLoadFuncs = sandbox.pageLoadFuncs;

      hub.notifyListeners("feed-change", feedInfo.uri);
    }
  };

  this.checkForManualUpdate = function checkForManualUpdate(cb) {
    if (LocalUriCodeSource.isValidUri(this.srcUri))
      cb(false);
    else {
      function onSuccess(data) {
        if (data != self.getCode()) {
          var confirmUrl = (CONFIRM_URL +
                            "?url=" +
                            encodeURIComponent(self.uri.spec) +
                            "&sourceUrl=" +
                            encodeURIComponent(self.srcUri.spec) +
                            "&updateCode=" +
                            encodeURIComponent(data));
          cb(true, confirmUrl);
        } else
          cb(false);
      };
      // TODO: We should call the callback w/ a false value or some kind
      // of error value if the Ajax request fails.
      jQuery.ajax({url: this.srcUri.spec,
                   dataType: "text",
                   success: onSuccess});
    }
  };

  this.finalize = function finalize() {
    // Not sure exactly why, but we get memory leaks if we don't
    // manually remove these.
    jQuery = null;
    sandbox.jQuery = null;
  };

  this.__proto__ = feedInfo;
}

function makeBuiltinGlobalsMaker(msgService, webJsm) {
  var Cc = Components.classes;
  var Ci = Components.interfaces;

  webJsm.importScript("resource://ubiquity/scripts/jquery.js");
  webJsm.importScript("resource://ubiquity/scripts/jquery_setup.js");
  webJsm.importScript("resource://ubiquity/scripts/template.js");

  var globalObjects = {};

  function makeGlobals(codeSource) {
    var id = codeSource.id;

    if (!(id in globalObjects))
      globalObjects[id] = {};

    return {
      XPathResult: webJsm.XPathResult,
      XMLHttpRequest: webJsm.XMLHttpRequest,
      jQuery: webJsm.jQuery,
      Template: webJsm.TrimPath,
      Application: webJsm.Application,
      Components: Components,
      feed: {id: codeSource.id,
             dom: codeSource.dom},
      pageLoadFuncs: [],
      globals: globalObjects[id],
      displayMessage: function() {
        msgService.displayMessage.apply(msgService, arguments);
      }
    };
  }

  return makeGlobals;
}

function makeBuiltins(languageCode, baseUri, parserVersion) {
  var basePartsUri = baseUri + "feed-parts/";
  var baseFeedsUri = baseUri + "builtin-feeds/";
  var baseScriptsUri = baseUri + "scripts/";

  var headerCodeSources = [
    new LocalUriCodeSource(basePartsUri + "header/utils.js"),
    new LocalUriCodeSource(basePartsUri + "header/cmdutils.js"),
    new LocalUriCodeSource(basePartsUri + "header/experimental_utils.js"),
    new LocalUriCodeSource(basePartsUri + "header/deprecated.js"),
    new LocalUriCodeSource(basePartsUri + "header/shared.js"),    
  ];
  var feeds = [
    baseFeedsUri + "onstartup.js"
  ];
  var footerCodeSources = [
    new LocalUriCodeSource(basePartsUri + "footer/final.js")
  ];

  // TODO: think of a better way to switch nountypes files for different languages
  // and keep english as a default, etc.
  // mitcho's guess: we should keep nountypes separate but verbs together... :/
  if (languageCode == "jp" && parserVersion < 2) {
    headerCodeSources = headerCodeSources.concat([
      new LocalUriCodeSource(basePartsUri + "header/jp/nountypes.js")
    ]);
    feeds = feeds.concat([
      baseFeedsUri + "jp/builtincmds.js"
    ]);
  } else if (languageCode == "en" || parserVersion == 2) {
    headerCodeSources = headerCodeSources.concat([
      new LocalUriCodeSource(baseScriptsUri + "date.js"),
      new LocalUriCodeSource(basePartsUri + "header/en/nountypes.js")
    ]);
    feeds = feeds.concat([
      baseFeedsUri + "en/builtincmds.js"
    ]);
  }

  return {
    feeds: feeds,
    headers: new IterableCollection(headerCodeSources),
    footers: new IterableCollection(footerCodeSources)
  };
}
