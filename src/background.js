// URLAutoRedirector
// Copyright (c) David Zhang, 2022
// Change/Update: 1224HuangJin, Informations: https://github.com/1224HuangJin/README/tree/main/URLAutoRedirector
// Idea inspired by Albert Li.

// default options
var defaultOptions = {
  options: {
    isNewTab: true,
    isNotify: false,
    rules: [
      // default rules {{{
          {
            "src": "^chrome://history(.*)",
            "dst": "about:blank",
            "isEnabled": true,
            "isRegex": false
          },
          {
            "src": "^chrome://downloads(.*)",
            "dst": "about:blank",
            "isEnabled": true,
            "isRegex": false
          },
          {
            "src": "^chrome://settings(.*)",
            "dst": "about:blank",
            "isEnabled": true,
            "isRegex": false
          },
          {
            "src": "^chrome://extensions(.*)",
            "dst": "about:blank",
            "isEnabled": true,
            "isRegex": false
          },
      // }}}
    ],
  },
};

var isNewTab;
var isNotify;
var rules;
var lastTabId = 0;

function matchUrl(url) {
  if (rules == undefined || url == undefined) {
    return false;
  }
  for (var i = 0; i < rules.length; i++) {
    var isEnabled = rules[i].isEnabled;
    var isRegex = rules[i].isRegex;
    var src = rules[i].src;
    var dst = rules[i].dst;

    if (isEnabled) {
      if (isRegex) {
        var re = new RegExp(src);
        if (url.search(re) != -1) {
          var newUrl = url.replace(re, dst);
          if (url != newUrl) {
            return newUrl;
          }
        }
      } else {
        if (url == src) {
          return dst;
        }
      }
    }
  }

  return false;
}

function getOptions(callback) {
  chrome.storage.sync.get('options', function (data) {
    if (data.options) {
      isNewTab = data.options.isNewTab;
      isNotify = data.options.isNotify;
      rules = data.options.rules;
    }
    callback();
  });
}

function notify() {
  if (!isNotify) {
    return;
  }

  chrome.notifications.create({
    type: 'progress',
    iconUrl: chrome.runtime.getURL('images/icon-48.png'),
    title: chrome.i18n.getMessage('ext_name'),
    message: chrome.i18n.getMessage('prompt_msg'),
    progress: 100,
  });
}

chrome.tabs.onUpdated.addListener(function (tabId, change, _tab) {
  if (change.status == 'loading') {
    var newUrl = matchUrl(change.url);
    if (newUrl) {
      console.log('[notice] matching with tabs event');
      console.log('[notice] matched: ' + change.url);
      console.log('[notice] redirecting to: ' + newUrl);
      if (isNewTab == false) {
        lastTabId = tabId;
        chrome.tabs.update({url: newUrl});
      } else {
        chrome.tabs.create({url: newUrl}, function (_tab) {
          notify();
        });
      }
    }
  }
  if (change.status == 'complete' && tabId == lastTabId) {
    notify();
    lastTabId = 0;
  }
});

chrome.runtime.onMessage.addListener(function (
  request,
  _sender,
  _sendResponse,
) {
  console.log('[msg:recv] ' + request.type);
  if (request.type == 'syncOptions') {
    isNewTab = request['options']['options']['isNewTab'];
    isNotify = request['options']['options']['isNotify'];
    rules = request['options']['options']['rules'];
  }
  if (request.type == 'resetRules') {
    var newOptions = {
      options: {
        isNewTab: isNewTab,
        isNotify: isNotify,
        rules: defaultOptions['options']['rules'],
      },
    };
    rules = defaultOptions['options']['rules'];
    chrome.storage.sync.set(newOptions, function () {
      var msg = {
        type: 'reloadOptions',
      };
      chrome.runtime.sendMessage(msg, function (_response) {
        console.log('[msg:send] reloadOptions');
      });
    });
  }
});

getOptions(function () {
  console.log('[notice] getOption Done');
});

chrome.runtime.onInstalled.addListener(function (details) {
  if (details.reason == 'install') {
    console.log('[event:onInstalled] set default options');
    chrome.storage.sync.set(defaultOptions);
  } else if (details.reason == 'update') {
    // try loading from local
    chrome.storage.local.get('options', function (data) {
      // if present, then set to sync and clear
      if (data.options && data.options.rules && data.options.rules.length > 0) {
        console.log('[event:onInstalled] found local options and migrating');
        chrome.storage.local.clear();
        chrome.storage.sync.set(data);
      }
    });
  }
});
