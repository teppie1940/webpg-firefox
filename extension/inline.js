/* <![CDATA[ */
if (typeof(webpg)=='undefined') { webpg = {}; }
// Enforce jQuery.noConflict if not already performed
if (typeof(jQuery)!='undefined') { webpg.jq = jQuery.noConflict(true); }

/*
    Class: webpg.inline
        Handles all inline GPG/PGP data found on content pages
*/
webpg.inline = {

    /*
        Function: init
            Sets up the context and calls the PGPDataSearch method to find
            PGP data in the page.

        Parameters:
            doc - <document> The document object to parse
    */
    init: function(doc, mode) {
        // Initialize webpg.doc
        this.doc = doc;

        this.mode = mode;

        this.action_selected = false;

        // Determine if inline decoration has been disabled for this page
        // TODO: Implement this
        //if (!webpg.inline.enabledForPage(doc.location))
        //    return;

        if (webpg.utils.detectedBrowser['vendor'] == "mozilla") {
            if (typeof(doc.nodeName)!='undefined' && doc.nodeName != "#document")
                return false;

            // Don't parse Firefox chrome pages
            try {
                if (doc.location.protocol == "chrome:") {
                    return false;
                }
            } catch (err) {
                console.log(err.message);
                return false;
            }
        }

        if (doc.location && doc.location.pathname.substr(-4) == ".pdf")
            return false;

        webpg.inline.PGPDataSearch(doc);
        
        if (webpg.utils.detectedBrowser['product'] == 'thunderbird')
            return;

        webpg.inline.existing_iframes = [];
        // Killing this, since I don't think we need it anymore...
//        var ifrms = doc.querySelectorAll("iframe");

//        for (var ifrm in ifrms) {
//            if (!isNaN(ifrm) && ifrms[ifrm].className.indexOf("webpg-") == -1) {
//                webpg.inline.existing_iframes.push(ifrms[ifrm]);
//                try {
//                    ifrms[ifrm].contentDocument.removeEventListener("contextmenu",
//                        webpg.overlay.contextHandler, true);
//                    ifrms[ifrm].contentDocument.addEventListener("contextmenu",
//                        webpg.overlay.contextHandler, true);
//                    webpg.inline.PGPDataSearch(ifrms[ifrm].contentDocument);
//                } catch (err) {
//                    console.log(err.message);
//                }
//            }
//        }

        var MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
        // Retrieve a reference to the appropriate window object
        // Check if the MutationObserver is not present
        if (typeof(MutationObserver) == 'undefined') {
            console.log("Using depreciated DOMSubtreeModified");
            window.addEventListener("DOMSubtreeModified", function(e) {
                if (e.target.nodeName == "IFRAME" && e.target.className.indexOf("webpg-") == -1 &&
                    webpg.inline.existing_iframes.indexOf(e.target) == -1) {
                    webpg.inline.existing_iframes.push(e.target);
                    try {
                        e.target.contentDocument.documentElement.removeEventListener("contextmenu",
                            webpg.overlay.contextHandler, true);
                        e.target.contentDocument.documentElement.addEventListener("contextmenu",
                            webpg.overlay.contextHandler, true);
                    } catch (err) {
                        console.log(err.message);
                    }
                    webpg.inline.PGPDataSearch(e.target.contentDocument, true);
                }
            }, true);
        } else {
            // Otherwise, use the MutationObserver
            // create an observer instance
            console.log("Using MutationObserver");
            var observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (doc.location.host.indexOf("mail.google.com") > -1) {
                        try {
                            doc.querySelectorAll(".Bu.y3")[0].style.display = "none";
                            doc.querySelectorAll(".AT")[0].style.display = "none";
                        } catch (err) {
                        }
                    }
                    if (mutation.target.nodeName == "IFRAME" && mutation.target.className.indexOf("webpg-") == -1 &&
                        webpg.inline.existing_iframes.indexOf(mutation.target) == -1) {
                        webpg.inline.existing_iframes.push(mutation.target);
                        try {
                            mutation.target.contentDocument.documentElement.removeEventListener("contextmenu",
                                webpg.overlay.contextHandler, true);
                            mutation.target.contentDocument.documentElement.addEventListener("contextmenu",
                                webpg.overlay.contextHandler, true);
                        } catch (err) {
                            console.log(err.message);
                        }
                        webpg.inline.PGPDataSearch(mutation.target.contentDocument, true, false, mutation.target);
                    } else {
                        if (doc.location.host.indexOf("mail.google.com") == -1) {
                            if (mutation.addedNodes.length > 0)
                                if (mutation.addedNodes[0].nodeName != "#text")
                                    webpg.inline.PGPDataSearch(mutation.addedNodes[0].ownerDocument, true, false, mutation.target);
                        }
                        // check if gmail message appears
                        if (webpg.jq(mutation.target).parent().is('.ii.gt.adP.adO')
                        || webpg.jq(mutation.target).parent().is('.adn.ads')) {
                            if (mutation.target.className.indexOf("webpg-") == -1
                            && webpg.jq(mutation.target).find(".webpg-node-odata").length < 1) {
                                if (webpg.jq(mutation.target).parent().is('.adn.ads'))
                                    if (webpg.jq(mutation.target).find('.ii.gt.adP.adO').length < 1)
                                        return false;
                                if (webpg.inline.existing_iframes.indexOf(mutation.target) == -1) {
                                    webpg.inline.existing_iframes.push(mutation.target);
                                    webpg.inline.PGPDataSearch(doc, false, true, mutation.target);
                                }
                            }
                        }
                    }
                });
            });

            // configuration of the observer:
            var config = { 'childList': true, 'subtree': true, 'attributes': false, 'characterData': false };
            var doc = (webpg.utils.detectedBrowser['vendor'] == 'mozilla') ? content.document :
                (webpg.inline.doc) ? webpg.inline.doc : document;

            try {
                observer.observe(doc, config);
            } catch (err) {
                console.log(err.message);
            }
        }
    },

    /*
        Function: PGPDataSearch
            Searches the document for elements that contain PGP Data blocks.
            Calls the PGPBlockParse method if PGP data is found

        Parameters:
            doc - <document> The document to search
            onchange - <bool> re-walk the DOM since this is a change
            gmail - <bool> This is a gmail message
    */
    PGPDataSearch: function(doc, onchange, gmail, root) {
        var node, range, idx, search, baseIdx;

        var elementFilter = function(node) {
            if (node.tagName == "IMG" || node.tagName == "SCRIPT" || node.tagName == "EMBED")
                return NodeFilter.FILTER_SKIP;
            return NodeFilter.FILTER_ACCEPT;
        };

        var textFilter = function(node) {
            return NodeFilter.FILTER_ACCEPT;
        };

        if (onchange == true) {
            try {
                var tw = doc.createTreeWalker(doc, NodeFilter.SHOW_ELEMENT, elementFilter, false);
            } catch (err) {
                return; // no access
            }
        } else {
            try {
                var tw = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT, elementFilter, false);
            } catch (err) {
                return; // no access
            }
        }

        while ((node = tw.nextNode())) {
            var previousElement = node.previousSibling;
//            if (webpg.utils.detectedBrowser['product'] == 'thunderbird' && node.nodeName == "PRE")
//                webpg.inline.addWebPGMenuBar(node);
            if ((node.nodeName == "TEXTAREA" ||
                node.getAttribute("contenteditable") == "true") &&
                (!previousElement || previousElement.className != "webpg-toolbar")) {
                if (node.style.display != "none" &&
                    node.style.visibility != "hidden" &&
                    node.offsetWidth > 200 &&
                    node.offsetHeight > 30 &&
                    node.offsetLeft >= node.offsetParent.scrollLeft) {

                    // Do not add toolbar item for the following domains
                    var blackListedDomains = [
                        // google mail is already enhanced with WebPG
                        "mail.google.com",
                        // Mozilla Add-ons
                        "addons.mozilla.org",
                    ];

                    var proceed = blackListedDomains.every(function(bldomain) {
                        return (doc.location.host.indexOf(bldomain) == -1);
                    });

                    if (proceed)
                        webpg.inline.addWebPGMenuBar(node);
                }
            }
        }

        var haveStart = false;
        var blockType;
        root = (root) ? root : doc.documentElement;
        var tw = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, textFilter, false);

        while((node = tw.nextNode())) {
            idx = 0;

            while(node && true) {
                if(!haveStart) {

                    if (node.parentNode.nodeName == "SCRIPT")
                        break;

                    if (node.parentNode.className.indexOf("webpg-node-odata") != -1)
                        break;

                    if (node.textContent.indexOf(webpg.constants.PGPTags.PGP_DATA_BEGIN, idx) == -1)
                        break;

                    if (node.parentNode && node.parentNode.nodeName == 'TEXTAREA')
                        break;

                    if (node.parentNode && node.parentNode.nodeName == 'PRE'
                    && node.parentNode.parentNode
                    && node.parentNode.parentNode.parentNode
                    && typeof node.parentNode.parentNode.parentNode.getAttribute == 'function'
                    && node.parentNode.parentNode.parentNode.getAttribute('id') == 'storeArea') {
                        // Possible TidyWiki document
                        var topwinjs = node.ownerDocument.defaultView.parent.wrappedJSObject;
                        if ("version" in topwinjs && topwinjs.version.title == "TiddlyWiki")
                            break; // It is, bail out
                    }
                    
                    if (node.textContent.search(/^.*?(-----BEGIN PGP.*?).*?(-----)/gim) < 0
                    || !node.textContent.search(/^.*?(-----END PGP.*?).*?(-----)/gim) < 0)
                        break;


                    baseIdx = idx;
                    idx = node.textContent.indexOf(webpg.constants.PGPTags.PGP_KEY_BEGIN, baseIdx);
                    blockType = webpg.constants.PGPBlocks.PGP_KEY;
                    search = webpg.constants.PGPTags.PGP_KEY_END;
                    if(idx == -1   || idx > node.textContent.indexOf(webpg.constants.PGPTags.PGP_SIGNATURE_BEGIN, baseIdx)) {
                        idx = node.textContent.indexOf(webpg.constants.PGPTags.PGP_SIGNATURE_BEGIN, baseIdx);
                        search = webpg.constants.PGPTags.PGP_SIGNATURE_END;
                        blockType = webpg.constants.PGPBlocks.PGP_SIGNATURE;
                    }
                    if(idx == -1   || idx > node.textContent.indexOf(webpg.constants.PGPTags.PGP_SIGNED_MSG_BEGIN, baseIdx)) {
                        idx = node.textContent.indexOf(webpg.constants.PGPTags.PGP_SIGNED_MSG_BEGIN, baseIdx);
                        search = webpg.constants.PGPTags.PGP_SIGNATURE_END;
                        blockType = webpg.constants.PGPBlocks.PGP_SIGNED_MSG;
                    }
                    if(idx == -1 || idx < node.textContent.indexOf(webpg.constants.PGPTags.PGP_ENCRYPTED_BEGIN, baseIdx)) {
                        idx = node.textContent.indexOf(webpg.constants.PGPTags.PGP_ENCRYPTED_BEGIN, baseIdx);
                        search = webpg.constants.PGPTags.PGP_ENCRYPTED_END;
                        blockType = webpg.constants.PGPBlocks.PGP_ENCRYPTED;
                    }
                    if(idx == -1 || idx < node.textContent.indexOf(webpg.constants.PGPTags.PGP_KEY_BEGIN, baseIdx)) {
                        idx = node.textContent.indexOf(webpg.constants.PGPTags.PGP_KEY_BEGIN, baseIdx);
                        search = webpg.constants.PGPTags.PGP_KEY_END;
                        blockType = webpg.constants.PGPBlocks.PGP_KEY;
                    }
                    if(idx == -1 || idx < node.textContent.indexOf(webpg.constants.PGPTags.PGP_PKEY_BEGIN, baseIdx)) {
                        idx = node.textContent.indexOf(webpg.constants.PGPTags.PGP_PKEY_BEGIN, baseIdx);
                        search = webpg.constants.PGPTags.PGP_PKEY_END;
                        blockType = webpg.constants.PGPBlocks.PGP_PKEY;
                    }

                    if(idx == -1)
                        break;

                    haveStart = true;
                    range = doc.createRange();
                    range.setStart(node, idx);
                    idx += 6;
                }
                if(haveStart) {
                    var tryOne = node.textContent.indexOf(search, idx);

                    if(tryOne == -1)
                        break;

                    idx = node.textContent.indexOf(search,
                        this.ignoreInners(idx, tryOne, node.textContent));

                    if(idx == -1) {
                        break;
                    }

                    haveStart = false;
                    range.setEnd(node, idx + search.length);

                    webpg.inline.PGPBlockParse(range, node, blockType, gmail);
                    range.detach();
                    idx = 0;
                }
            }
        }
    },

    /*
        Function: ignoreInners
            Avoids detection of PGP blocks found inside of other PGP blocks.

        Parameters:
            idx - <int> The current position of the block detected
            end - <int> The last position of the block detected
            node - <object> The node we are currently working on
    */
    ignoreInners: function(idx, end,node) {
        if  (end == -1)
            return -1;

        var baseIdx = idx;

        idx = node.indexOf(webpg.constants.PGPTags.PGP_KEY_BEGIN, baseIdx);
        var search = webpg.constants.PGPTags.PGP_KEY_END;

        if(idx == -1) {
            idx = node.indexOf(webpg.constants.PGPTags.PGP_SIGNED_MSG_BEGIN, baseIdx);
            search = webpg.constants.PGPTags.PGP_SIGNATURE_END;
        }
        if(idx == -1) {
            idx = node.indexOf(webpg.constants.PGPTags.PGP_ENCRYPTED_BEGIN, baseIdx);
            search = webpg.constants.PGPTags.PGP_ENCRYPTED_END;
        }
        if(idx == -1) {
            idx = node.indexOf(webpg.constants.PGPTags.PGP_PKEY_BEGIN, baseIdx);
            search = webpg.constants.PGPTags.PGP_PKEY_END;
        }

        if(idx == -1 || idx > end)
            return end;

        return node.indexOf(search,
            this.ignoreInners(idx + 6,node.indexOf(search,idx + 6),node)
        ) + 6;
    },

    /*
        Function: PGPBlockParse
            Parses range contents and sends the appropriate request for
            the PGP blocks discovered. Calls the addResultsFrame method
            for any matching PGP blocks.

        Parameters:
            range - <range> The range containing the identified PGP block
            node - <obj> The node that PGP data was discovered in
            blockType - <int> The type of webpg.constants.PGPBlocks found
    */
    PGPBlockParse: function(range, node, blockType, gmail) {
        var s = new XMLSerializer();
        var d = range.cloneContents();
        var str = s.serializeToString(d);
        var xmlnsReg = new RegExp(" xmlns=\"http://www.w3.org/1999/xhtml\"", "gi");
        var wbrReg = new RegExp("\<wbr\>", "gi");
        var doc = (webpg.utils.detectedBrowser['vendor'] == 'mozilla') ? content.document :
            (webpg.inline.doc) ? webpg.inline.doc : document;

        str = str.replace(xmlnsReg, "");
        str = str.replace(wbrReg, "\n");

        var html = node.parentNode.innerHTML;

        while (html.lastIndexOf("\n") + 1 == html.length) {
            html = html.substring(0, html.lastIndexOf("\n")).replace(wbrReg, "");
        }

        var scontent = webpg.utils.getPlainText(node.parentNode);

        if (scontent.search(/^\s*?(-----BEGIN PGP.*?)/gi) < 0)
            scontent = webpg.utils.clean(str);

        if (webpg.utils.detectedBrowser['product'] == 'thunderbird') {
            var tmp_scontent = str.replace(new RegExp("<[^>]+>", "gim"), "");
            if (tmp_scontent.search(/^\s*?(-----BEGIN PGP.*?--\n.*?\n\n)/gi) > -1)
                scontent = tmp_scontent;
        }

        // The html contents posted to element is the textContent or innerText
        //  of the element with detected PGP Blocks
        var h = doc.createElement("pre");
        webpg.jq(h).html(scontent);
        if (webpg.utils.detectedBrowser['product'] == 'thunderbird')
            var phtml = h.childNodes[0].nodeValue.replace(new RegExp(String.fromCharCode(160).toString(), "gim"), " ");
        else
            var phtml = h.innerHTML;

        // Strip any whitespace from the phtml value
        while (phtml.indexOf("\n") == 0) {
            phtml = phtml.substring(1, phtml.length);
        }

        if (webpg.utils.detectedBrowser['product'] == 'thunderbird') {
            // In thunderbird, we need to use the HTML, which the rendered plaintext
            //  value of the message. Because it is escaped html, we then need to
            //  place it back into our temporary element and retrieve the nodeValue
            //  for proper parsing.
            scontent = html.replace(/\n/gim, "").replace(/<br>/gim, "\n");
            h.innerHTML =  webpg.descript(escape(scontent));
            scontent = unescape(h.childNodes[0].nodeValue);
            if (scontent.search(new RegExp("(&(.){1,4};)", "g")) > -1
            && phtml.search(new RegExp("(&(.){1,4};)", "g")) == -1)
                scontent = phtml;
        }

        console.log("scontent:\n" + scontent);
        console.log("phtml:\n" + phtml);
        console.log("html:\n" + html);

        if (html.search(/^\s*?(-----BEGIN PGP.*?)/gi) > -1
        && html.search(/^.*?(-----BEGIN PGP.*?<br>)/gim) == -1
        && html.search(/^.*?(<br>-----BEGIN PGP.*?)/gim) == -1
        && html.search(/^.*?(<br>Version.*?)/gim) == -1
        && html.search(new RegExp("(&(.){1,4};)", "g")) == -1) {
            console.log("using html");
            scontent = html;
        } else if ((html.search(/.*?(-----BEGIN PGP.*?-----<br>)/gim) > -1
        || html.search(/^.*?(<br>-----BEGIN PGP.*?)/gim) > -1
        || html.search(/^\s*?(-----BEGIN PGP.*?)<br>/gi) > -1)
        && phtml.search(new RegExp("(&(.){1,4};)", "g")) == -1
        && (phtml.search(new RegExp("<[^>]+>", "gim")) > -1
        || gmail)
        && webpg.utils.detectedBrowser['product'] != 'thunderbird') {
            if (html.search(new RegExp("(&(.){1,4};)", "g")) == -1
            && webpg.utils.detectedBrowser['vendor'] == 'mozilla'
            && gmail == true) {
                scontent = html.replace(/\n/gim, "")
                    .replace(new RegExp("<div[^>]*><br></div>", "gim"), "\n\n")
                    .replace(new RegExp("<div[^>]*></div>", "gim"), "")
                    .replace(new RegExp("<div[^>]*>(.*?)</div>", "gim"), "$1")
                    .replace(/<br>/gim, "\n")
                    .replace(wbrReg, "");
                console.log("using html cleaned for gmail");
            } else {
                if (gmail) {
                    phtml = webpg.utils.linkify(phtml).replace(new RegExp("<div[^>]*></div>", "gim"), "")
                        .replace(new RegExp("<div[^>]*>(.*?)</div>", "gim"), "$1")
                        .replace(wbrReg, "");
                    if (html.search(new RegExp("<div[^>]*><br><br>.*?-----BEGIN PGP.*?-----", "gim")) > -1
                    && phtml.search(RegExp("\n\n.*?\n-----BEGIN PGP.*?-----", "gim")) > -1)
                        phtml = phtml.replace(RegExp("\n(\n.*?\n-----BEGIN PGP.*?-----)", "gim"), "$1");
                }
                console.log("using phtml");
                scontent = webpg.utils.linkify(phtml);
            }
        } else {
            if (scontent.search(/^\s*?(-----BEGIN(\s|&nbsp;|\%20)PGP.*?)(\n|%0A)/gi) < 0) {
                if (phtml.search(/^\s*?(-----BEGIN PGP.*?--\n.*?\n\n)/gi) > -1)
                    scontent = phtml;
                else
                    scontent = html;
            }

            scontent = scontent.replace(new RegExp(" " + String.fromCharCode(160).toString() + " ", "gim"), " \n  ")
                .replace(new RegExp(String.fromCharCode(160).toString(), "gim"), " ");

            if (scontent.search(new RegExp("<\\s[^>]+\\s>", "gim")) > -1
            && html.search(new RegExp("<\\s[^>]+\\s>", "gim")) == -1)
                scontent = scontent.replace(new RegExp("<\\s([^>]+)\\s>", "gim"), "<$1>");

//            if (gmail) {
//                if (html.match(new RegExp("<a[^>]*>(.*?)</a>", "gim")) > -1)
//                    scontent = webpg.utils.linkify(scontent);
//                scontent = webpg.utils.linkify(scontent);
//            }

            if (html.search(new RegExp("<div[^>]*><br><br>.*?-----BEGIN PGP.*?-----", "gim")) > -1
            && scontent.search(RegExp("\n\n.*?\n-----BEGIN PGP.*?-----", "gim")) > -1)
                scontent = scontent.replace(RegExp("\n(\n.*?\n-----BEGIN PGP.*?-----)", "gim"), "$1");

            console.log("using scontent");
        }

        if (webpg.utils.detectedBrowser['vendor'] == 'mozilla')
            scontent = scontent.replace(/([\"|>])\s(\b.*?)\s([\"|<])(?:\/)/gim, "$1$2$3");

        var fragment = range.extractContents();

        var results_frame = webpg.inline.addResultsFrame(range.commonAncestorContainer, range);

        var originalNodeData = doc.createElement("span");
        originalNodeData.setAttribute("class", "webpg-node-odata");
        originalNodeData.setAttribute("style", "white-space: pre;");
        originalNodeData.setAttribute("id", "webpg-node-odata-" + results_frame.id);
        originalNodeData.textContent = scontent;

        range.insertNode(originalNodeData);

        var posX = webpg.jq(originalNodeData).width() - 60;

        var badge = webpg.inline.addElementBadge(doc, posX, results_frame.id, originalNodeData);

        if (this.mode == "window") {
            webpg.jq(originalNodeData).hide();
            webpg.jq(badge).hide();
        }

        originalNodeData.appendChild(badge);

        switch(blockType) {
            case webpg.constants.PGPBlocks.PGP_KEY:
                console.log("WebPG found a public key");
                if (webpg.utils.detectedBrowser['vendor'] == "mozilla") {
                    webpg.utils.sendRequest({
                        'msg': "sendtoiframe",
                        'block_type': blockType,
                        'target_id': results_frame.id,
                        'original_text': scontent
                    });
                } else {
                    results_frame.onload = function() {
                        webpg.utils.sendRequest({
                            'msg': "sendtoiframe",
                            'block_type': blockType,
                            'target_id': results_frame.id,
                            'original_text': scontent
                        });
                    };
                }
                break;

            case webpg.constants.PGPBlocks.PGP_PKEY:
                console.log("WebPG found a private key, which is scary when you think about it... exiting");
                break;

            case webpg.constants.PGPBlocks.PGP_SIGNED_MSG:
                // check for the required PGP BLOCKS
                console.log("WebPG found a signed message");
                if (scontent.indexOf(webpg.constants.PGPTags.PGP_DATA_BEGIN) != -1 &&
                    scontent.indexOf("\n" + webpg.constants.PGPTags.PGP_SIGNATURE_BEGIN) != -1 &&
                    scontent.indexOf("\n" + webpg.constants.PGPTags.PGP_SIGNATURE_END) != -1 ) {
                } else {
                    if (scontent.indexOf(" " + webpg.constants.PGPTags.PGP_SIGNATURE_END) != -1) {
                        console.log("WebPG found a signed message with bad formatting");
                    } else {
                        console.log("WebPG found an incomplete signed message");
                    }
                }
                webpg.utils.sendRequest({
                    'msg': 'verify',
                    'data': scontent},
                    function(response) {
                        if (response.result.gpg_error_code == "58" || !response.result.error) {
                            webpg.utils.sendRequest({
                                'msg': "sendtoiframe",
                                'block_type': blockType,
                                'target_id': results_frame.id,
                                'verify_result': response.result}
                            );
                            if (webpg.utils.detectedBrowser['vendor'] == "mozilla") {
                                webpg.utils.sendRequest({
                                    'msg': "sendtoiframe",
                                    'block_type': blockType,
                                    'target_id': results_frame.id,
                                    'verify_result': response.result}
                                );
                            } else {
                                results_frame.onload = function() {
                                    webpg.utils.sendRequest({
                                        'msg': "sendtoiframe",
                                        'block_type': blockType,
                                        'target_id': results_frame.id,
                                        'verify_result': response.result}
                                    );
                                };
                            }
                        } else {
                            webpg.jq(results_frame).hide();
                            webpg.jq(element).children(".original").show();
                            webpg.jq(element).children(".pretext, .postext").hide();
                            console.log("error processing signed message", response.result);
                        }
                    }
                );
                break;

            case webpg.constants.PGPBlocks.PGP_SIGNATURE:
                // This should never be reached, because our parser should
                //  normally catch both the text, and the detached sig
                console.log("WebPG found a detached signature, but we don't have the file - exiting");
                break;

            case webpg.constants.PGPBlocks.PGP_ENCRYPTED:
                console.log("WebPG found an encrypted or signed message");
                webpg.utils.sendRequest({
                    // WebPG found a PGP MESSAGE, but it could be a signed. Lets gpgVerify first
                    'msg': 'verify',
                    'data': scontent,
                    'target_id': results_frame.id },
                    function(response) {
                        if (response.result.signatures && response.result.data)
                            blockType = webpg.constants.PGPBlocks.PGP_SIGNED_MSG;
                        else
                            blockType = webpg.constants.PGPBlocks.PGP_ENCRYPTED;
                        webpg.utils.sendRequest({
                            'msg': "sendtoiframe",
                            'block_type': blockType,
                            'target_id': results_frame.id,
                            'verify_result': response.result
                        });
                        if (webpg.utils.detectedBrowser['vendor'] == "mozilla") {
                            webpg.utils.sendRequest({
                                'msg': "sendtoiframe",
                                'block_type': blockType,
                                'target_id': results_frame.id,
                                'verify_result': response.result
                            });
                        } else {
                            results_frame.onload = function() {
                                webpg.utils.sendRequest({
                                    'msg': "sendtoiframe",
                                    'block_type': blockType,
                                    'target_id': results_frame.id,
                                    'verify_result': response.result
                                });
                            };
                        }
                    }
                );
                break;
        }
    },

    createSecretKeySubmenu: function(purpose, action) {
        var _ = webpg.utils.i18n.gettext;
        var submenu = "";
        for (var key in webpg.inline.secret_keys) {
            if (webpg.inline.secret_keys[key]['can_' + purpose]
            && webpg.inline.secret_keys[key].revoked == false
            && webpg.inline.secret_keys[key].expired == false
            && webpg.inline.secret_keys[key].disabled == false) {
                var keyObj = webpg.inline.secret_keys[key];
                var email = (keyObj.email.length > 1) ?
                    "&lt;" + webpg.utils.escape(keyObj.email) + "&gt;" :
                    "(" + _("no email address provided") + ")";
                var detail = webpg.utils.escape(keyObj.subkeys[0].size) +
                    webpg.utils.escape(keyObj.subkeys[0].algorithm_name)[0].toUpperCase() +
                    "/" + key.substr(-8);
                var opacity = (keyObj.default == true) ? 1.0 : 0;
                submenu += '' +
                    '<li class="webpg-action-btn">' +
                        '<a class="webpg-toolbar-' + action + '" id="0x' + key + '" style="padding-top:2px;">' +
                            keyObj.name + '&nbsp;' + "(" + detail + ")<br/>" + email +
                            '<img style="position: absolute;top: 4px;right: 4px;opacity:' + opacity + ';" src="' + webpg.utils.escape(webpg.utils.resourcePath) + 'skin/images/check-small.png"/>' +
                        '</a>' +
                    '</li>'
            }
        }
        return submenu;
    },

    createWebPGActionMenu: function(toolbar, gmail) {
        var _ = webpg.utils.i18n.gettext;

        if (!gmail) {
            webpg.jq(toolbar).find('.webpg-action-menu').css({
                'padding': '0 8px',
                'cursor': 'pointer',
                'height': '24px',
                'background': '#aaa url(' + webpg.utils.escape(webpg.utils.resourcePath) + 'skin/images/menumask.png) repeat-x',
                'border-radius': '0 4px 4px 0',
                'display': 'inline-block',
                'border-right': '1px solid #999',
            }).hover(
                function(e) {
                    if (webpg.jq(toolbar).find('.webpg-action-list')[0].style.display != 'inline') {
                        webpg.jq(this).css({
                            'background-color': '#f92',
                        })
                    }
                },
                function(e) {
                    if (webpg.jq(toolbar).find('.webpg-action-list')[0].style.display != 'inline') {
                        webpg.jq(this).css({
                            'background-color': '#aaa',
                        })
                    }
                }
            );
        }

        webpg.jq(toolbar).find('.webpg-action-menu .webpg-action-list-icon').css({
            'display': 'inline-block', 'width': '0',
            'height': '0', 'text-indent': '-9999px',
            'position': 'relative', 'top': '-3px',
            'border-left': '4px solid transparent',
            'border-right': '4px solid transparent',
            'border-top': '4px solid #000000',
            'opacity': '0.7', 'content': '\\2193',
        });
        if (webpg.utils.detectedBrowser['vendor'] == 'mozilla'
        &&  gmail) {
             webpg.jq(toolbar).find('.webpg-action-menu .webpg-action-list-icon').css({
                'top': '10px',
             });
        }
        webpg.jq(toolbar).find('.webpg-toolbar-sign-callout .webpg-action-list-icon').css({
            'display': 'inline-block', 'width': '0',
            'height': '0', 'text-indent': '-9999px',
            'position': 'relative', 'top': '48%',
            'border-left': '4px solid transparent',
            'border-right': '4px solid transparent',
            'border-top': '4px solid #000000',
            'opacity': '0.7', 'content': "\\2193",
        });
        webpg.jq(toolbar).find('.webpg-toolbar-sign-callout').css({
            'display': (Object.keys(webpg.inline.secret_keys).length < 2) ? 'none' : 'inline-block',
        });
        webpg.jq(toolbar).find('ul.webpg-action-list, ul.webpg-subaction-list').css({
            'position': 'absolute', 'top': '100%', 'left': '-2px',
            'z-index': '4', 'float': 'left', 'display': 'none',
            'min-width': '200px', 'padding': '0', 'margin': '0',
            'list-style': 'none', 'background-color': '#ffffff',
            'border-color': '#ccc', 'border-color': 'rgba(0, 0, 0, 0.2)',
            'border-style': 'solid', 'border-width': '1px',
            '-webkit-border-radius': '0 4px 4px 4px',
            '-moz-border-radius': '0 4px 4px 4px',
            'border-radius': '0 4px 4px 4px',
            '-webkit-box-shadow': '0 5px 10px rgba(0, 0, 0, 0.2)',
            '-moz-box-shadow': '0 5px 10px rgba(0, 0, 0, 0.2)',
            'box-shadow': '0 5px 10px rgba(0, 0, 0, 0.2)',
            '-webkit-background-clip': 'padding-box',
            '-moz-background-clip': 'padding',
            'background-clip': 'padding-box',
            '*border-right-width': '2px',
            '*border-bottom-width': '2px',
            'text-align': 'left',
        });
        if (gmail) {
            if (webpg.gmail.gmailComposeType == "inline") {
                webpg.jq('.nH.nn .no .nH.nn.aQK').css({'width': '600px'}).parent().parent().css({'width': '600px'})
                webpg.jq(toolbar).find('ul.webpg-action-list').css({
                    'top': 'auto', 'bottom': '36px', 'left': '6px'
                });
                webpg.jq("*[g_editable='true']").focus();
            }
            webpg.jq('.webpg-subaction-btn .webpg-action-list-icon').css({ 'top': '0' })
        }
        webpg.jq(toolbar).find('.webpg-action-list li').css({
            'border-style': 'solid', 'border-width': '1px',
            '-webkit-border-radius': '4px 4px 4px 4px',
            '-moz-border-radius': '4px 4px 4px 4px',
            'border-radius': '4px 4px 4px 4px',
            'border-color': 'transparent',
        });
        webpg.jq(toolbar).find('.webpg-action-list li, .webpg-subaction-list li').css({
            'font-size': '12px',
            'height': '28px',
            'line-height': '24px',
            'position': 'relative',
            'padding': '0 6px 2px 6px',
            'display': 'block',
            'float': 'none',
        }).hover(
            function(e) {
                webpg.jq(this).css({
                    'background-color': '#e6e6e6',
                    'background-image': 'url("' + webpg.utils.escape(webpg.utils.resourcePath) + 'skin/images/menumask.png")',
                    'background-repeat': 'repeat-x',
                    'border-color': '#ccc', 'border-color': 'rgba(0, 0, 0, 0.2)',
                })
            },
            function(e) {
                webpg.jq(this).css({
                    'background-color': 'transparent',
                    'background-image': 'none',
                    'border-color': 'transparent',
                 })
            }
        ).find('.webpg-li-icon').css({
            'width': '24px',
            'height': '24px',
            'padding': '0 4px 0 4px',
            'margin': '0',
            'position': 'relative',
            'top': '5px',
        });
        webpg.jq(toolbar).find('.webpg-subaction-btn').css({
            'top': '-1', 'padding': '0 8px 2px 8px', 'margin-right': '-5px',
            'border-style': 'solid', 'border-width': '1px',
            '-webkit-border-radius': '0 4px 4px 0',
            '-moz-border-radius': '0 4px 4px 0',
            'border-radius': '0 4px 4px 0',
        })
        webpg.jq(toolbar).find('.webpg-subaction-list').css({
            'top': '0', 'left': '100%',
        });
        webpg.jq(toolbar).find('.webpg-action-divider').css({
            'border-width': '1px 0 0 0',
            'border-style': 'solid',
            'border-color': 'rgba(0, 0, 0, 0.1)',
            'height': '0',
            'font-size': '1px',
            'padding': '0',
        });
        webpg.jq(toolbar).find('img').css({
            'display': 'inline-block',
            'margin': '0',
        });
        webpg.jq(toolbar).find('.webpg-action-btn img').css({
            'width': '20px',
            'height': '20px',
        });
        webpg.jq(toolbar).find('.webpg-action-list a').css({
            'display': 'block',
            'text-decoration': 'none',
            'color': 'black',
            'position': 'relative',
            'height': '32px',
            'text-shadow': 'none',
            'cursor': 'pointer',
            'white-space': 'nowrap',
        });
        webpg.jq(toolbar).find('.webpg-subaction-list a').css({
            'padding-top': '3px',
            'line-height': '12px',
            'padding-right': '30px',
        });

        if (!gmail) {
            webpg.jq(toolbar).children(":first").click(function(e) {
                webpg.jq(toolbar).find('.webpg-action-menu').css({
                    'background-color': '#fa3',
                })
                var list = webpg.jq(toolbar).find('.webpg-action-list');
                list.css({
                    'display': (this.style.display == 'inline') ? 'none' : 'inline'
                });
            });
        }
        webpg.jq(toolbar).find('.webpg-subaction-btn').click(function(e) {
            var list = webpg.jq(this).parent().parent().find('.webpg-subaction-list');
            list[0].seen = false;
            list[0].style.display = (list[0].style.display == "inline") ? "none" : "inline";
        }).hover(function(e) {
            var list = webpg.jq(this).parent().parent().find('.webpg-subaction-list');
            if (e.type == "mouseleave" && list[0].seen)
                list[0].style.display = "none";
        });
        webpg.jq(toolbar).find('.webpg-subaction-list').hover(function(e) {
            if (e.type == "mouseleave")
                this.style.display = 'none';
        });
        webpg.jq(toolbar).find('.webpg-subaction-list li').hover(
            function(e) {
                this.parentElement.seen = true;
                var toolbarStatus = (!gmail) ? webpg.jq(toolbar).find('.webpg-toolbar-status') : gmail.children().first();
                this.oldStatusText = toolbarStatus.html();
                if (e.type == "mouseenter" && toolbarStatus) {
                    var key = webpg.jq(this).find('a')[0].id.substr(2);
                    var keyObj = webpg.inline.secret_keys[key];
                    if (keyObj) {
                        var detail = webpg.utils.escape(keyObj.subkeys[0].size) +
                                webpg.utils.escape(keyObj.subkeys[0].algorithm_name)[0].toUpperCase() +
                                "/" + key.substr(-8);
                        var keyText = (keyObj.email.length > 0) ? webpg.utils.escape(keyObj.email) :
                            webpg.utils.escape(keyObj.name);
                        keyText += " (" + detail + ")";
                        toolbarStatus.text(_("Use") + " " + keyText);
                    }
                } else {
                    if (this.oldStatusText)
                        toolbarStatus.text(this.oldStatusText);
                }
            },
            function(e) {
                var toolbarStatus = (!gmail) ? webpg.jq(toolbar).find('.webpg-toolbar-status') : gmail.children().first();
                if (this.oldStatusText)
                    toolbarStatus.html(this.oldStatusText);
            }
        );

    },

    addWebPGMenuBar: function(element) {
        var _ = webpg.utils.i18n.gettext;
        // Store the elements display setting in case modifying the dom
        //  puts the element into an order that would hide it.
        var original_display = element.style.display || 'inline';
        element.style.whiteSpace = "pre";
        var doc = (webpg.utils.detectedBrowser['vendor'] == 'mozilla') ? content.document :
            (webpg.inline.doc) ? webpg.inline.doc : document;
        var toolbar = doc.createElement("div");

        toolbar.setAttribute("style", "text-align:left; padding: 0; padding-right: 8px; font-weight: bold; " +
            "font-family: arial,sans-serif; font-size: 11px; position:relative;" +
            "background: #f1f1f1 url('" + webpg.utils.escape(webpg.utils.resourcePath) + 
            "skin/images/menumask.png') repeat-x; border-collapse: separate;" +
            "color:#444; height:24px; margin: 1px 0 0 1px; display: block;" +
            "border: 1px solid gainsboro; top: 27px; clear: left; line-height: 12px;" +
            "left: -1px; text-shadow: none; text-decoration: none;");

        toolbar.setAttribute("class", "webpg-toolbar");
        var offset = (element.scrollHeight > element.offsetHeight) ?
                element.offsetWidth - element.clientWidth - 1 : 0;
        offset = (webpg.utils.detectedBrowser['vendor'] == 'mozilla') ?
            1 : offset;
        toolbar.style.width = element.offsetWidth - 11 - offset + "px";
        element.style.paddingTop = (webpg.utils.detectedBrowser['vendor'] == 'mozilla') ?
            "28px" : "30px";
        element.style.marginTop = "1px";
        webpg.jq(toolbar).insertBefore(element);
        element.style.display = original_display;

        var action_menu = '' +
            '<span class="webpg-action-menu">' +
                '<span class="webpg-current-action" style="line-height:24px;">' +
                    '<img src="' + webpg.utils.escape(webpg.utils.resourcePath) +
                        "skin/images/badges/32x32/webpg.png" + '" style="position:relative; ' +
                        'top:4px; left:-4px; width:16px; height:16px;"/>' +
                    'WebPG' +
                '</span>' +
                '&nbsp;' +
                '<span class="webpg-action-list-icon">' +
                    '&nbsp;' +
                '</span>' +
            '</span>' +
            '<span style="z-index:4;">' +
                '<ul class="webpg-action-list">' +
                    '<li class="webpg-action-btn">' +
                        '<a class="webpg-toolbar-encrypt">' +
                            '<img src="' + webpg.utils.escape(webpg.utils.resourcePath) + 'skin/images/badges/20x20/stock_encrypted.png" class="webpg-li-icon"/>' +
                            _('Encrypt') +
                        '</a>' +
                    '</li>' +
                    '<li class="webpg-action-btn">' +
                        '<a class="webpg-toolbar-sign" style="display:inline-block;">' +
                            '<img src="' + webpg.utils.escape(webpg.utils.resourcePath) + 'skin/images/badges/20x20/stock_signature-ok.png" class="webpg-li-icon"/>' +
                            _('Sign only') +
                        '</a>' +
                        '<ul class="webpg-toolbar-sign-callout" style="top:0;' +
                            'right:4px;width:20px;display:inline-block;' +
                            'position:absolute;padding:0;">' +
                            '<li class="webpg-subaction-btn">' +
                                '<span class="webpg-action-list-icon">' +
                                    '&nbsp;' +
                                '</span>' +
                            '</li>' +
                        '</ul>' +
                        '<ul class="webpg-subaction-list">' +
                            webpg.inline.createSecretKeySubmenu('sign', 'sign') +
                        '</ul>' +
                    '</li>' +
                    '<li class="webpg-action-btn">' +
                        '<a class="webpg-toolbar-cryptsign">' +
                            '<img src="' + webpg.utils.escape(webpg.utils.resourcePath) + 'skin/images/badges/20x20/stock_encrypted_signed.png" class="webpg-li-icon"/>' +
                            _('Sign and Encrypt') +
                        '</a>' +
                        '<ul class="webpg-toolbar-sign-callout" style="top:0;right:4px;width:20px;display:inline-block;position:absolute;padding:0;">' +
                            '<li class="webpg-subaction-btn">' +
                                '<span class="webpg-action-list-icon">' +
                                    '&nbsp;' +
                                '</span>' +
                            '</li>' +
                        '</ul>' +
                        '<ul class="webpg-subaction-list">' +
                            webpg.inline.createSecretKeySubmenu('sign', 'cryptsign') +
                        '</ul>' +
                    '</li>' +
                    '<li class="webpg-action-btn">' +
                        '<a class="webpg-toolbar-symcrypt">' +
                            '<img src="' + webpg.utils.escape(webpg.utils.resourcePath) + 'skin/images/badges/20x20/stock_encrypted.png" class="webpg-li-icon"/>' +
                            _('Symmetric Encryption') +
                        '</a>' +
                    '</li>' +
                    '<li class="webpg-action-btn webpg-pgp-crypttext">' +
                        '<a class="webpg-toolbar-decrypt">' +
                            '<img src="' + webpg.utils.escape(webpg.utils.resourcePath) + 'skin/images/badges/20x20/stock_decrypted.png" class="webpg-li-icon"/>' +
                            _('Decrypt') +
                        '</a>' +
                    '</li>' +
                    '<li class="webpg-action-btn webpg-pgp-import">' +
                        '<a class="webpg-toolbar-import">' +
                            '<img src="' + webpg.utils.escape(webpg.utils.resourcePath) + 'skin/images/badges/20x20/stock_keypair.png" class="webpg-li-icon"/>' +
                            _('Import') +
                        '</a>' +
                    '</li>' +
                    '<li class="webpg-action-btn webpg-pgp-export">' +
                        '<a class="webpg-toolbar-export">' +
                            '<img src="' + webpg.utils.escape(webpg.utils.resourcePath) + 'skin/images/badges/20x20/stock_keypair.png" class="webpg-li-icon"/>' +
                            _('Export') +
                        '</a>' +
                    '</li>' +
                    '<li class="webpg-action-btn webpg-pgp-signtext">' +
                        '<a class="webpg-toolbar-verify">' +
                            '<img src="' + webpg.utils.escape(webpg.utils.resourcePath) + 'skin/images/badges/20x20/stock_signature-ok.png" class="webpg-li-icon"/>' +
                            _('Verify') +
                        '</a>' +
                    '</li>' +
                    '<li class="webpg-action-divider">' +
                    '</li>' +
                    '<li class="webpg-action-btn webpg-option-item webpg-secure-editor">' +
                        '<a class="webpg-toolbar-secure-editor">' +
                            '<img src="' + webpg.utils.escape(webpg.utils.resourcePath) + 'skin/images/badges/20x20/secure_editor.png" class="webpg-li-icon"/>' +
                            _('Secure Editor') +
                        '</a>' +
                    '</li>' +
                    '<li class="webpg-action-btn webpg-option-item webpg-keymanager-link">' +
                        '<a class="webpg-toolbar-keymanager-link">' +
                            '<img src="' + webpg.utils.escape(webpg.utils.resourcePath) + 'skin/images/badges/20x20/stock_keypair.png" class="webpg-li-icon"/>' +
                            _('Key Manager') +
                        '</a>' +
                    '</li>' +
                    '<li class="webpg-action-btn webpg-option-item webpg-options-link">' +
                        '<a class="webpg-toolbar-options-link">' +
                            '<img src="' + webpg.utils.escape(webpg.utils.resourcePath) + 'skin/images/badges/32x32/webpg.png" class="webpg-li-icon"/>' +
                            _('Options') +
                        '</a>' +
                    '</li>' +
                '</ul>' +
            '</span>';

        webpg.jq(toolbar).append(action_menu);
        webpg.jq(toolbar).append('<span class="webpg-toolbar-status" style="text-transform: uppercase; float:right; position:relative; top: 20%; line-height: 14px;"></span>');
        webpg.jq(toolbar.ownerDocument.defaultView).bind("resize", function() {
            detectElementValue(element);
        });
        detectElementValue(element);

        function setActive(e) {
            if (e.toElement
            && e.toElement.parentElement
            && (e.toElement.parentElement.className == "webpg-subaction-list"
            || (e.toElement.parentElement.parentElement
            && e.toElement.parentElement.parentElement.className == "webpg-subaction-list")))
                return;

            detectElementValue(element);
            // Get the current textarea value or selection
            var selection = { 'selectionText': element.value,
                'pre_selection': '', 'post_selection': '' };

            if (!webpg.overlay.isContextMenuOpen)
                webpg.overlay.contextSelection = selection;

            webpg.inline.toolbarTextSelection = selection;

            if (!webpg.overlay.isContextMenuOpen
            && !webpg.overlay.block_target) {
                webpg.overlay.insert_target = element;
            }

            updateOffset(element);
        }

        function updateOffset(element) {
            var offset = (element.scrollHeight > element.offsetHeight) ?
                element.offsetWidth - element.clientWidth - 1 : 0;
            offset = (webpg.utils.detectedBrowser['vendor'] == 'mozilla') ?
                1 : offset;
            toolbar.style.width = element.offsetWidth - 10 - offset + "px";
        }

        webpg.jq([element, toolbar]).bind('change keydown keyup mousemove mouseover mouseenter mouseleave',
            setActive
        );

        function isSecure(element) {
            // Check if this is a secured editor provided by WebPG
            var elementDoc = element.ownerDocument;
            var elementWin = 'defaultView' in elementDoc ? elementDoc.defaultView : elementDoc.parentWindow;
            if ((elementDoc.location.protocol == "chrome:" ||
                elementDoc.location.protocol == "chrome-extension:")) {
                if (webpg.utils.detectedBrowser['vendor'] == 'mozilla')
                    var loc = elementDoc.location.protocol + "//" + elementDoc.location.host + elementDoc.location.pathname;
                else
                    var loc = elementDoc.location.origin + elementDoc.location.pathname;
                return (loc == webpg.utils.resourcePath + "dialog.html");
            }
        }

        function detectElementValue(element) {
            var element_value = null;

            if (element.offsetLeft != toolbar.offsetLeft && element.style.display !== 'none') {
                toolbar.style.marginLeft = element.offsetLeft - 9;
            }

            if (element.nodeName == "TEXTAREA")
                element_value = element.value;
            else if (element.nodeName == "DIV" || element.nodeName == "PRE")
                element_value = element.innerText || element.textContent;

            // Show the appropriate action for the textarea value or selection
            if (element_value.length > 1 && element_value.indexOf(
                webpg.constants.PGPTags.PGP_SIGNED_MSG_BEGIN) > -1) {
                // Verify
                webpg.jq(toolbar).find('.webpg-action-btn').hide();
                webpg.jq(toolbar).find('.webpg-pgp-signtext').show();
                webpg.jq(toolbar).find('.webpg-toolbar-status').text(_("PGP Signed Message"));
            } else if (element_value.length > 1 && element_value.indexOf(
                webpg.constants.PGPTags.PGP_ENCRYPTED_BEGIN) > -1) {
                // Decrypt
                webpg.jq(toolbar).find('.webpg-action-btn').hide();
                webpg.jq(toolbar).find('.webpg-pgp-crypttext').show();
                webpg.jq(toolbar).find('.webpg-toolbar-status').text(_("PGP ENCRYPTED OR SIGNED MESSAGE"));
            } else if (element_value.length > 1 && element_value.indexOf(
                webpg.constants.PGPTags.PGP_KEY_BEGIN) > -1) {
                // Import
                webpg.jq(toolbar).find('.webpg-action-btn').hide();
                webpg.jq(toolbar).find('.webpg-pgp-import').show();
                webpg.jq(toolbar).find('.webpg-toolbar-status').text(_("PGP Public Key"));
            } else {
                // Plain text or non-PGP data
                if (element_value.length < 1 && isSecure(element) !== true) {
                    webpg.jq(toolbar).find('.webpg-action-btn').hide();
                    webpg.jq(toolbar).find('.webpg-pgp-export').show();
                    webpg.jq(toolbar).find('.webpg-action-btn.webpg-option-item.webpg-secure-editor').show();
                } else {
                    webpg.jq(toolbar).find('.webpg-action-btn').show();
                    webpg.jq(toolbar).find('.webpg-pgp-export').hide();
                }
                webpg.jq(toolbar).find('.webpg-pgp-crypttext, .webpg-pgp-signtext, .webpg-pgp-import').hide();
                var elementTitle;
                if (isSecure(element) == true) {
                    elementTitle = _("WebPG Secure Editor");
                    webpg.jq(toolbar).find('.webpg-action-btn.webpg-option-item.webpg-secure-editor').hide()
                } else {
                    elementTitle = _("Unsecured Editor");
                }
                webpg.jq(toolbar).find('.webpg-toolbar-status').text(elementTitle);
            }
            webpg.jq(toolbar).find('.webpg-keymanager-link').show();
            webpg.jq(toolbar).find('.webpg-options-link').hide();
            updateOffset(element);
        }

        element.updateElementValue = detectElementValue;

        webpg.inline.createWebPGActionMenu(toolbar);

        webpg.jq(toolbar).bind('mouseleave', function() {
            if (webpg.jq(toolbar).find('.webpg-action-list')[0].style.display == "inline") {
                webpg.jq(toolbar).find('.webpg-action-list, .webpg-subaction-list').hide();
                webpg.jq(toolbar).find('.webpg-action-menu').css({
                    'background-color': '#aaa',
                })
            }
  
        });

        webpg.jq(toolbar).find('.webpg-action-list a').click(function(e) {
            var textarea = e.currentTarget.parentNode.parentNode.parentNode.parentNode.nextSibling;
            var selection = (webpg.inline.toolbarTextSelection == null) ?
                {'selectionText': textarea.value || textarea.innerText,
                    'pre_selection': '',
                    'post_selection': '',
                } :
                webpg.inline.toolbarTextSelection;
            webpg.overlay.insert_target = textarea;
            var link_class = e.currentTarget.className;

            var action = (link_class == "webpg-toolbar-encrypt") ?
                webpg.constants.overlayActions.CRYPT :
                (link_class == "webpg-toolbar-cryptsign") ?
                webpg.constants.overlayActions.CRYPTSIGN :
                (link_class == "webpg-toolbar-decrypt") ?
                webpg.constants.overlayActions.DECRYPT :
                (link_class == "webpg-toolbar-symcrypt") ?
                webpg.constants.overlayActions.SYMCRYPT :
                (link_class == "webpg-toolbar-sign") ?
                webpg.constants.overlayActions.PSIGN :
                (link_class == "webpg-toolbar-decrypt") ?
                webpg.constants.overlayActions.DECRYPT :
                (link_class == "webpg-toolbar-import") ?
                webpg.constants.overlayActions.IMPORT :
                (link_class == "webpg-toolbar-export") ?
                webpg.constants.overlayActions.EXPORT :
                (link_class == "webpg-toolbar-verify") ?
                webpg.constants.overlayActions.VERIF : 
                (link_class == "webpg-toolbar-options-link") ?
                webpg.constants.overlayActions.OPTS :
                (link_class == "webpg-toolbar-keymanager-link") ?
                webpg.constants.overlayActions.MANAGER :
                (link_class == "webpg-toolbar-secure-editor") ?
                webpg.constants.overlayActions.EDITOR : false;

            webpg.inline.before_action_value = selection;

            webpg.jq(toolbar).find('.webpg-action-list').hide();
            webpg.jq(toolbar).find('.webpg-action-menu').css({
                'background-color': '#aaa',
            })

            if (action) {
                if (action != webpg.constants.overlayActions.EDITOR)
                    webpg.overlay.block_target = true;
                signers = (e.currentTarget
                        && e.currentTarget.id
                        && e.currentTarget.id.search("0x") == 0) ?
                    [e.currentTarget.id.substr(2)] : null;
                    
                webpg.overlay.onContextCommand(null, action, {'source': 'toolbar', 'dialog': (isSecure(element) == true), 'signers': signers}, selection);
            }

            webpg.inline.action_selected = (action != webpg.constants.overlayActions.OPTS && action != webpg.constants.overlayActions.MANAGER);

            webpg.jq(toolbar).find('.webpg-action-list').hide();

        });

        if (webpg.utils.detectedBrowser['vendor'] == 'mozilla') {
            webpg.jq(toolbar).css({ 'top': '28px' });
            webpg.jq(toolbar).find('.webpg-action-menu .webpg-action-list-icon').css({ 'top': '6px' });
        }

    },

    addElementBadge: function(doc, posX, id, control) {

        var badge = doc.createElement("span");
        var posY = "-6";

        if (control.nodeName.toLowerCase() == "textarea") {
            posX = "-50";
        } else {
            var posY = "-34";
        }

        badge.setAttribute("style", "width:30px;" +
            "display:inline-block;position:relative;top:" + posY + "px;left:" + posX + "px;" +
            "padding:1px 2px 3px 0;border-radius: 70px; z-index:1;");
        badge.setAttribute("id", "webpg-badge-toggle-" + id);
        badge.setAttribute("class", "webpg-badge-toggle");

        badge.innerHTML = "<a style='border:none;' class='webpg-badge-toggle-link'><img style='opacity:0.5;width:28px;height:28px;' src='" +
                webpg.utils.resourcePath + "skin/images/badges/32x32/webpg.png'/></a>";

        webpg.jq(badge).find('img').hover(
            function() {
                this.style.opacity = '1.0';
                webpg.jq(this).parent().parent()[0].style.backgroundColor = '#333333';
                webpg.jq(this).parent().parent()[0].style.boxShadow = 'black 1px 1px 6px';
            },
            function() {
                this.style.opacity = '0.5';
                webpg.jq(this).parent().parent()[0].style.backgroundColor = 'transparent';
                webpg.jq(this).parent().parent()[0].style.boxShadow = '';
            }
        );

        webpg.jq(badge).find('.webpg-badge-toggle-link').click(function(e) {
            var link_id = webpg.jq(this).parent()[0].id
            var target_id = link_id.substr(link_id.lastIndexOf("-") + 1, link_id.length);
            webpg.jq(control).hide();
            webpg.jq(this).parent().hide();
            webpg.jq(this.ownerDocument.getElementById(target_id)).show();
            webpg.utils.sendRequest({
                'msg': 'sendtoiframe',
                'msg_to_pass': 'resizeiframe',
                'target_id': target_id,
                'iframe_id': target_id
            });
        });

        return badge;
    },

    /*
        Function: addResultsFrame
            Creates the results container(s) and iframe for the inline formatting

        Parameters:
            node - <obj> The node that PGP data was discovered in
            range - <range> The range containing the identified PGP block
    */
    addResultsFrame: function(node, range) {
        var doc = (webpg.utils.detectedBrowser['vendor'] == 'mozilla') ? content.document :
            (webpg.inline.doc) ? webpg.inline.doc : document;
        var iframe = doc.createElement("iframe");
        var id = (new Date()).getTime();
        iframe.name = id;
        iframe.id = id;
        iframe.setAttribute('id', id);
        iframe.setAttribute('name', id);
        iframe.className = "webpg-result-frame"
        iframe.scrolling = "no";
        iframe.frameBorder = "none";
        iframe.style.border = "1px solid #000";
        iframe.style.position = "relative";
        iframe.style.borderRadius = "6px";
        iframe.style.boxShadow = "2px 2px 2px #000";
        iframe.style.margin = "auto";
        iframe.style.top = "0";
        iframe.style.width = "100%";
        iframe.style.minHeight = "220px";
        iframe.style.backgroundColor = "#efefef";
        iframe.style.zIndex = "9999";
        if (this.mode == "icon")
            iframe.style.display = 'none';
        webpg.utils._onRequest.addListener(function(request) {
            if (request.msg == "toggle") {
                try {
                    if (request.target_id == iframe.id) {
                        var parentNode = node.parentNode;
                        if (!webpg.jq(parentNode).find('.webpg-node-odata').length > 0) {
                            parentNode = parentNode.parentNode;
                        }
                        webpg.jq(parentNode).find('.webpg-node-odata').toggle();
                        webpg.jq(parentNode).find("#webpg-badge-toggle-" + iframe.id).toggle();
                        webpg.jq(iframe).toggle();
                    }
                } catch (err) {
                    console.log(err);
                    return;
                }
            } else if (request.msg == "show") {
                try {
                    if (request.target_id == iframe.id) {
                        webpg.jq(node.parentNode).find('.webpg-node-odata').hide();
                        webpg.jq(node.parentNode).find("#webpg-badge-toggle-" + iframe.id).hide();
                        webpg.jq(iframe).show();
                    }
                } catch (err) {
                    console.log(err);
                    return;
                }
            }
        });
        if (range) {
            range.insertNode(iframe);
            var theURL = webpg.utils.resourcePath + "webpg_results.html?id=" + id;
            if (webpg.utils.detectedBrowser['vendor'] == "mozilla")
                iframe.contentWindow.location.href = theURL;
            else
                iframe.src = theURL;
        }
        return iframe;
    },

    /*
        Function: addResultsReplacementFrame
            Creates a results iframe that replaces the element that contained
            the original PGP data

        Parameters:
            element - The HTML element that contained the PGP Data
    */
    addResultsReplacementFrame: function(element) {
        var iframe = this.addResultsFrame();
        var doc = (webpg.utils.detectedBrowser['vendor'] == 'mozilla') ? content.document :
            (webpg.inline.doc) ? webpg.inline.doc : document;
        iframe.style.minWidth = 300;
        if (element.style.width)
            iframe.style.width = element.style.width;
        webpg.jq(iframe).insertAfter(webpg.jq(element));
        webpg.jq(element).hide();
        webpg.utils._onRequest.addListener(function(request) {
            try {
                if (request.msg == "toggle" && request.target_id == iframe.id) {
                    webpg.jq(element).show();
                    webpg.jq(iframe).remove();
                }
            } catch (err) {
                // Do nothing
            }
        });
        var theURL = webpg.utils.resourcePath + "webpg_results.html?id=" + iframe.id;
        if (webpg.utils.detectedBrowser['vendor'] == "mozilla")
            iframe.contentWindow.location.href = theURL;
        else
            iframe.src = theURL;
        return iframe;
    },

    addDialogFrame: function(theURL, dialogType, height, width) {
        if (!height)
            height = 400;
        if (!width)
            width = 640;
        var doc = (webpg.utils.detectedBrowser['vendor'] == 'mozilla') ? content.document :
            (webpg.inline.doc) ? webpg.inline.doc : document;
        if (height > doc.defaultView.innerHeight)
            height = doc.defaultView.innerHeight - 35;
        var iframe = doc.createElement('iframe');
        var id = (new Date()).getTime();
        iframe.name = id;
        iframe.id = id;
        iframe.setAttribute('id', id);
        iframe.setAttribute('name', id);
        iframe.className = "webpg-dialog";
        iframe.scrolling = "no";
        iframe.frameBorder = "none";
        iframe.style.position = "absolute";
        iframe.style.border = "none";
        iframe.style.margin = "auto";
        if (dialogType == "editor")
            iframe.style.minHeight = "378px";
        iframe.style.width = width + "px";
        iframe.style.height = height + "px";
        iframe.style.marginLeft = "-50px";
        iframe.style.marginTop = "50px";
        iframe.style.zIndex = "9999";
        iframe.style.backgroundColor = "transparent";

        webpg.overlay.insert_target.ownerDocument.body.appendChild(iframe);

        if (webpg.utils.detectedBrowser['vendor'] == "mozilla") {
            iframe.contentWindow.location.href = theURL;
        } else if (webpg.utils.detectedBrowser['product'] == "chrome") {
            iframe.src = theURL;
        }

        return iframe;
    },
}
/* ]]> */
