// == Core Developer Commands ==
//
// This is the command feed for core developer commands.

// === {{{markupTickets()}}} ===
//
// This function finds any text in the given JQuery query that looks like
// a Trac ticket and hyperlinks the text to the ticket.
function markupTickets(query) {
  var regexps = [/(#)([0-9]+)/g,
                 /([T|t]icket )([0-9]+)/g];
  var template = ('<a href="https://ubiquity.mozilla.com/' +
                  'trac/ticket/$2">$1$2</a>');
  regexps.forEach(
    function(regexp) {
      query.html(query.html().replace(regexp, template));
    });
}

// === {{{addMoreLinks()}}} ===
//
// Adds a row labeled "more" to the changeset detail page, with links
// to additional information contained in the revision, such as
// the built-in documentation.
function addMoreLinks(rev, doc) {
  var newRow = jQuery('<tr><th class="files">more</th></tr>', doc);
  newRow.append('<td class="files">' +
                '<a href="/hg/ubiquity-firefox/raw-file/' + rev +
                '/ubiquity/index.html">documentation</a></td>');
  jQuery("#changesetEntry", doc).append(newRow);
}

var BUILDBOT_BASE = "https://ubiquity.mozilla.com/buildbot/";

// === {{{getBuildInfo()}}} ===
//
// Scrapes a buildbot "one line per build" page and returns an array
// containing information for each build.
function getBuildInfo(page) {
  var builds = [];
  jQuery("li", page).each(
    function(i) {
      var revRegexp = /.*rev=\[([0-9a-f]+)\].*/;
      builds.push({rev: jQuery(this).text().match(revRegexp)[1],
                   href: (BUILDBOT_BASE +
                          jQuery("a:not(:first)", this).attr("href")),
                   isSuccessful: jQuery(".success", this).length > 0
                  });
    }
  );
  return builds;
}

// === {{{addBuildbotInfo()}}} ===
//
// Mashes up Buildbot data with the given HG log page.

function addBuildbotInfo(doc) {
  jQuery(".bigtable tr:first", doc).prepend(
    '<th class="description">buildbot</th>'
  );
  jQuery(".bigtable tr:not(:first)", doc).prepend(
    '<td class="buildbot"></td>'
  );
  jQuery.get(
    BUILDBOT_BASE + "one_line_per_build",
    null,
    function(data) {
      var builds = getBuildInfo(jQuery(data, doc));
      builds.forEach(
        function mashupBuildWithLog(build) {
          var revUrl = "/hg/ubiquity-firefox/rev/" + build.rev;
          var revSelector = (".bigtable a[href='" + revUrl + "']");
          var row = jQuery(revSelector, doc).parent().parent();
          var status = jQuery("<div>&nbsp;</div>", doc);
          var bgColor = "#ff0000";
          var title = "This build may have errors.";
          if (build.isSuccessful) {
            bgColor = "#00ff00";
            title = "This build passed all tests.";
          }
          status.css({backgroundColor: bgColor,
                      width: "1em",
                      opacity: "0.5"});
          jQuery(".buildbot", row).append(status);
          status.wrap('<a title="' + title +
                      '" href="' + build.href + '"></a>');
        });
    },
    "html"
  );
}

// === {{{pageLoad_developerCommands()}}} ===
//
// This function is a page-load function that applies transformations
// to certain developer-related web pages to provide added functionality.
function pageLoad_developerCommands(doc) {
  if ((doc.location.protocol == "http:" ||
       doc.location.protocol == "https:") &&
      doc.location.host == 'ubiquity.mozilla.com') {
    var regexp = /\/hg\/ubiquity-firefox\/rev\/([0-9a-f]+)/;
    var match = doc.location.pathname.match(regexp);
    if (match) {
      var rev = match[1];
      markupTickets(jQuery(".description", doc));
      addMoreLinks(rev, doc);
    } else if (doc.location.pathname == '/hg/ubiquity-firefox/') {
      addBuildbotInfo(doc);
    }
  }
}
