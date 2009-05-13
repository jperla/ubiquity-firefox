Components.utils.import("resource://ubiquity/modules/parser/original/parser.js");
Components.utils.import("resource://ubiquity/tests/framework.js");

const MAX_SUGGESTIONS = 10;
var emptyContext = {textSelection:"", htmlSelection:""};

var JpParser = NLParser1.getPluginForLanguage("jp");

function testJpSplitByParticles() {
  var sentence1 = "彼女と駅に行った";
  var parsedSentence = JpParser._splitByParticles(sentence1);
  this.assert( parsedSentence["と"] == "彼女");
  this.assert( parsedSentence["に"] == "駅");
  this.assert( parsedSentence["動詞"] == "行った");
}

function testJpSplitByParticles2() {
  var sentence1 = "これを英語から日本語に翻訳して";
  var parsedSentence = JpParser._splitByParticles(sentence1);
  this.assert( parsedSentence["を"] == "これ");
  this.assert( parsedSentence["から"] == "英語");
  this.assert( parsedSentence["に"] == "日本語");
  this.assert( parsedSentence["動詞"] == "翻訳して");
}

function testJpSplitByParticles3() {
  var sentence1 = "計算して";
  var parsedSentence = JpParser._splitByParticles(sentence1);
  this.assert( parsedSentence["動詞"] == "計算して");
}


function testJapaneseParserBasic() {
  /* Q: What's the U.S. state where everybody stabs their enemies with knives?
   * A: Tekisasu!
   */
  var dareGaSasareta = null;
  var tekiType = {
    suggest: function(text,html) {
      if (text == "敵") {
	return [NounUtils.makeSugg("敵")];
      } else
	return [];
    }
  };
  var cmd_sasu = {
    execute: function(context, dobj, modifiers) {
      dareGaSasareta = modifiers["を"].text;
    },
    name:"刺す",
    DOLabel: null,
    DOType: null,
    modifiers: {"を": tekiType }
  };
  var parser = makeTestParser( "jp",
				[cmd_sasu],
				[tekiType] );
  var input = "敵を刺す";
  var query = parser.newQuery(input, emptyContext, MAX_SUGGESTIONS);
  var suggList = query.suggestionList;
  this.assert(suggList.length == 1,
              "Should be 1 suggestion, not " + suggList.length);
  this.assert(suggList[0]._verb._name == "刺す", "Should be sasu");
  this.assert(suggList[0]._argSuggs["を"].text == "敵", "Should be teki");
  suggList[0].execute(emptyContext);
  this.assert(dareGaSasareta == "敵", "Enemy should be stabbed.");

  var input2 = "友達を刺す";
  query = parser.newQuery(input2, emptyContext, MAX_SUGGESTIONS);
  suggList = query.suggestionList;
  this.assert(suggList.length == 0, "Should be no suggestions.");
}


function testJapaneseParserSomeMore() {
  var noun_type_mono = {
    _name: "もの",
    suggest: function( text, html, callback ) {

    }
  };
  var cmd_suru = {
    name: "する",
    DOLabel: "thing",
    DOType: noun_type_mono,
    execute: function(context, directObject) {

    }
  };

  var parser = makeTestParser( "jp",
			       [cmd_suru],
			       [noun_type_mono] );
  var query = parser.newQuery( "", emptyContext, MAX_SUGGESTIONS);
  var suggestionList = query.suggestionList;
  // TODO tests here that advanced features still work in japanese parser
  // version: synonyms, defaults, suggestion ranking, async suggestions, etc.
}

// TODO test japanese parsing right in this file by passing "jp" instead of
// LANG into the command manager.
