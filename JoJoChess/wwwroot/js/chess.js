"use strict";

//VARIABLES
var connection = new signalR.HubConnectionBuilder()
    .withUrl("/chesshub")
    .build();

var hours, minutes, seconds;
var secondsLeft;
var countdown = document.getElementById("timer");

var imgSrcArr = [   
    ["content/images/figures/s1/rb.png", "content/images/figures/s1/nb.png",
        "content/images/figures/s1/bb.png", "content/images/figures/s1/qb.png",
        "content/images/figures/s1/kb.png", "content/images/figures/s1/bb.png",
        "content/images/figures/s1/nb.png", "content/images/figures/s1/rb.png",
        "content/images/figures/s1/pb.png"       
    ],
    ["content/images/figures/s1/rw.png", "content/images/figures/s1/nw.png",
        "content/images/figures/s1/bw.png", "content/images/figures/s1/qw.png",
        "content/images/figures/s1/kw.png", "content/images/figures/s1/bw.png",
        "content/images/figures/s1/nw.png", "content/images/figures/s1/rw.png",
        "content/images/figures/s1/pw.png"
    ]
];
var turnsCounter = 0;
var piecesCounter = 0;

var turnZones = [];

const TURN_ZONE = "showTurnZone";
const BEAT_ZONE = "showBeatZone";
const CASTLING_ZONE = "showCastlingZone";
const IS_PICKED = "showIsPicked";

const MOVE_TURN = "move";
const BEAT_TURN = "beat";
const ENPASSANT_TURN = "enPassant";
const CASTLING_TURN = "castling";

const ROOK_MOVE_INDEXES = [-10, 1, 10, -1];
const BISHOP_MOVE_INDEXES = [-11, 9, 11, -9];
const QUEEN_MOVE_INDEXES = [-10, -9, 1, 11, 10, 9, -1, -11];

var board = [];

var user = {
    "name": getCookie("name"),
    "side": null,
    "joinedRoom": null,
    "isInTurn": false,
    "roomStatus": null//owner/guest
};
var funcArr = [linearTurnZones, knightTurnZones,
    linearTurnZones, linearTurnZones,
    kingTurnZones, linearTurnZones,
    knightTurnZones, linearTurnZones, pawnTurnZones];

var isKingAttacked = 0;
var isKingPotentiallyAttacked = false;
var kingUnderAttack = null;

var notations = document.getElementById("notations");

function RecurringTimer(callback, delay) {
    var timerId, start, remaining = delay;

    this.pause = function () {
        window.clearTimeout(timerId);
        remaining -= new Date() - start;
    };

    var resume = function () {
        start = new Date();
        timerId = window.setTimeout(function () {
            remaining = delay;
            resume();
            callback();
        }, remaining);
    };

    this.resume = resume;

    this.resume();
}
var timer; 

var exchangeContainer = document.getElementById("exchangeContainer");
var hideVariants = document.getElementById("hideVariants");
var roomManipulate = document.getElementById("roomManipulate");
var settingsContainer = document.getElementById("settingsContainer");
var availableRooms = document.getElementById("availableRooms");
var gameInfo = document.getElementById("gameInfo");
var notationsDiv = document.getElementById("notationsDiv");

var previousStyleIndex1 = "0", previousStyleIndex2 = "0", previousStyleIndex3 = "0";

var exchangeInfo;

//START CONNECTION
document.getElementById("createRoomButton").disabled = true;
document.getElementById("deleteRoomButton").disabled = true;
connection.start().then(function () {
    document.getElementById("createRoomButton").disabled = false;
    document.getElementById("deleteRoomButton").disabled = false;

    document.getElementById("board").classList.toggle("show");
    console.log(user.name + " connected!");
   
    var styles = localStorage.getItem("styleIndexes");

    if (styles !== null) {
        setColorPalette(styles[0]);
        setBoardStyles(styles[1]);
        setFigureStyles(styles[2]);
    }    
}).catch(function (err) {
    return console.error(err.toString());
});
function getCookie(name) {
    let matches = document.cookie.match(new RegExp(
        "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
    ));
    return matches ? decodeURIComponent(matches[1]) : undefined;
}

//STYLES BLOCK
document.getElementById("stylesButton").addEventListener("click", function (event) {
    document.getElementById("stylesSelectors").classList.toggle("show");
    event.preventDefault();
});
document.getElementById("acceptStylesButton").addEventListener("click", function (event) {
    document.getElementById("stylesSelectors").classList.toggle("show");

    var e1 = document.getElementById("colorPalette");
    var e2 = document.getElementById("boardStyles");
    var e3 = document.getElementById("piecesStyles");

    if (e1.options[e1.selectedIndex].value != previousStyleIndex1) {
        setColorPalette(e1.options[e1.selectedIndex].value);
    }
    if (e2.options[e2.selectedIndex].value != previousStyleIndex2) {
        setBoardStyles(e2.options[e2.selectedIndex].value);
    }
    if (e3.options[e3.selectedIndex].value != previousStyleIndex3) {
        setFigureStyles(e3.options[e3.selectedIndex].value);
    }

    event.preventDefault(); 
});

function setColorPalette(index) {
    var color1, color2;
    
    switch (index) {
        case "0":
            color1 = "#FECE9E";//lighter
            color2 = "#D18B46";
            previousStyleIndex1 = "0";
            break;
        case "1":
            color1 = "#D4D1CC";
            color2 = "#A4A19C";
            previousStyleIndex1 = "1";
            break;
        case "2":
            color1 = "#A0C9FF";
            color2 = "#59A1FF";
            previousStyleIndex1 = "2";
            break;
        case "3":
            color1 = "#E4C5D6";//lighter
            color2 = "#F09DAE";
            previousStyleIndex1 = "3";
            break;
        case "4":
            color1 = "#F3DB6E";
            color2 = "#E4854D";
            previousStyleIndex1 = "4";
            break;
        case "5":
            color1 = "#B8F8BD";
            color2 = "#6DA772"; 
            previousStyleIndex1 = "5";
            break;

    }
    colorPalette();

    function colorPalette() {
        exchangeContainer.style.backgroundColor = color1;
        hideVariants.style.backgroundColor = color2;
        roomManipulate.style.backgroundColor = color1;
        settingsContainer.style.backgroundColor = color1;
        availableRooms.style.backgroundColor = color1;
        gameInfo.style.backgroundColor = color2;
        notationsDiv.style.backgroundColor = color1;
    }
}
function setBoardStyles(index) {
    switch (index) {
        case "0":
            document.getElementById("centralBoard").style.backgroundImage = "url('../content/images/boards/board0.png')";
            previousStyleIndex2 = "0";
            break;
        case "1":
            document.getElementById("centralBoard").style.backgroundImage = "url('../content/images/boards/board1.png')";
            previousStyleIndex2 = "1";
            break;
        case "2":
            document.getElementById("centralBoard").style.backgroundImage = "url('../content/images/boards/board2.png')";
            previousStyleIndex2 = "2";
            break;
        case "3":
            document.getElementById("centralBoard").style.backgroundImage = "url('../content/images/boards/board3.png')";
            previousStyleIndex2 = "3";
            break;
        case "4":
            document.getElementById("centralBoard").style.backgroundImage = "url('../content/images/boards/board4.png')";
            previousStyleIndex2 = "4";
            break;
        case "5":
            document.getElementById("centralBoard").style.backgroundImage = "url('../content/images/boards/board5.png')";
            previousStyleIndex2 = "5";
            break;
    }
}
function setFigureStyles(index) {
    switch (index) {
        case "0":
            previousStyleIndex3 = "0";
            setFiguresImg("0");
            break;
        case "1":
            setFiguresImg("1");
            previousStyleIndex3 = "1";
            break;
        case "2":
            setFiguresImg("2");
            previousStyleIndex3 = "2";
            break;
        case "3":
            setFiguresImg("3");
            previousStyleIndex3 = "3";
            break;
    }

    function setFiguresImg(index){
        imgSrcArr = [
            ["content/images/figures/s" + index + "/rb.png", "content/images/figures/s" + index +"/nb.png",
                "content/images/figures/s" + index + "/bb.png", "content/images/figures/s" + index +"/qb.png",
                "content/images/figures/s" + index + "/kb.png", "content/images/figures/s" + index +"/bb.png",
                "content/images/figures/s" + index + "/nb.png", "content/images/figures/s" + index +"/rb.png",
                "content/images/figures/s" + index +"/pb.png"
            ],
            ["content/images/figures/s" + index + "/rw.png", "content/images/figures/s" + index +"/nw.png",
                "content/images/figures/s" + index + "/bw.png", "content/images/figures/s" + index +"/qw.png",
                "content/images/figures/s" + index + "/kw.png", "content/images/figures/s" + index +"/bw.png",
                "content/images/figures/s" + index + "/nw.png", "content/images/figures/s" + index +"/rw.png",
                "content/images/figures/s" + index +"/pw.png"
            ]
        ];
    }
}

//CREATE/CLEAR BOARD
function createBoard() {
    var k = 0;
    for (var i = 0; i < 8; i++) {        
        for (var j = 0; j < 8; j++) {
            var elem = document.getElementById(k);
            elem.addEventListener("click", pieceAction, false);
            var square = {
                "div": elem,
                "isAttacked": false,
                "isForDefend": false,
                "underAttack": null,
                "piece": null
            }
            board.push(square);
            k++;
        }
        board.push(null, null);
        k += 2;
    }  
}
function clearBoard() {
    for (var i in board) {
        if (board[i] != null && board[i].piece != null) {
            board[i].div.removeChild(board[i].piece.img);
        }
    }
    board = [];
}

function initializeBoard() {
    createBoard();

    var values = ["r0", "n1", "b2", "q3", "k4", "b5", "n6", "r7",
                  "p8", "p9", "p10", "p11", "p12", "p13", "p14", "p15",
                  "p0", "p1", "p2", "p3", "p4", "p5", "p6", "p7",
                  "r8", "n9", "b10", "q11", "k12", "b13", "n14", "r15"];
    var valuesCounter = 0;

    var enemySide;
    var sideIndex;
    var enemySideIndex;

    if (user.side == "white") {
        sideIndex = 1;
        enemySide = "black";
        enemySideIndex = 0;     
        document.getElementById("centralBoard").style.pointerEvents = 'auto';         
    } else {
        var v = values[3];
        values[3] = values[4];
        values[4] = v;
        v = values[27];
        values[27] = values[28];
        values[28] = v;

        values.reverse();

        enemySide = "white";
        sideIndex = 0;
        enemySideIndex = 1;
        document.getElementById("centralBoard").style.pointerEvents = 'none';
    }

    //enemy others row initialize
    for (var i = 0; i < 8; i++) {
        var img = document.createElement("img");
        img.src = imgSrcArr[enemySideIndex][i];

        board[i].div.appendChild(img);

        board[i].piece = {
            value: values[valuesCounter],
            side: enemySide,
            img: img
        };
        valuesCounter++;
    }
    //enemy pawns row initialize
    for (var i = 10; i < 18; i++) {
        var img = document.createElement("img");
        img.src = imgSrcArr[enemySideIndex][8];

        board[i].div.appendChild(img);

        board[i].piece = {
            value: values[valuesCounter],
            side: enemySide,
            img: img,
            enPassant: 0
        };
        valuesCounter++;
    }
    
    //your pawns row initialize
    var imgId;

    for (var i = 60; i < 68; i++) {
        var img = document.createElement("img");
        img.src = imgSrcArr[sideIndex][8];
        img.style.cursor = "pointer";
        img.addEventListener("click", pawnTurnZones, false);
        imgId = values[valuesCounter];
        img.id = imgId;
        board[i].div.appendChild(img);
            
        board[i].piece = {
            value: imgId,
            side: user.side,
            img: img,
            enPassant: 0
        };

        valuesCounter++;
    }
   
    //your others row initialize
    var j;

    for (var i = 70; i < 78; i++) {
        j = i - 70;
        var img = document.createElement("img");
        img.src = imgSrcArr[sideIndex][j];
        img.style.cursor = "pointer";
        img.addEventListener("click", funcArr[j], false);
        imgId = values[valuesCounter];
        img.id = imgId;

        board[i].div.appendChild(img);

        board[i].piece = {
            value: imgId,
            side: user.side,
            img: img
        };
        valuesCounter++;
    }

    piecesCounter = 16;

    initializeExchangeWindow();

    //king and rooks isFirstTurn property for castling mechanics

    if (user.side == "black") {
        //swap king and queen if user side == black
        var blackKing = board[73];
        var blackQueen = board[74];
        var BKPiece = blackKing.piece;

        blackKing.div.removeChild(blackKing.piece.img);
        blackQueen.div.removeChild(blackQueen.piece.img);

        blackKing.div.appendChild(blackQueen.piece.img);
        blackQueen.div.appendChild(blackKing.piece.img);

        blackKing.piece = blackQueen.piece;
        blackQueen.piece = BKPiece;

        //----------------------------------//

        var whiteKing = board[3];
        var whiteQueen = board[4];
        var WKPiece = whiteKing.piece;

        whiteKing.div.removeChild(whiteKing.piece.img);
        whiteQueen.div.removeChild(whiteQueen.piece.img);

        whiteKing.div.appendChild(whiteQueen.piece.img);
        whiteQueen.div.appendChild(whiteKing.piece.img);

        whiteKing.piece = whiteQueen.piece;
        whiteQueen.piece = WKPiece;

        //----------------------------------//
        blackKing.piece.isFirstTurn = true;
        
    } else {
        board[74].piece.isFirstTurn = true;
    }

    board[70].piece.isFirstTurn = true;
    board[77].piece.isFirstTurn = true;
    
}//TEST FIGURES

function pieceAction(event) {
    if (turnZones.length > 0) {
        var turnInfo = null;
        try {
            if (this.classList.contains(TURN_ZONE)) {
                turnInfo = movePiece(this.id, MOVE_TURN);
            } else if (board[this.id].piece != null && this.classList.contains(BEAT_ZONE)) {
                turnInfo = movePiece(this.id, BEAT_TURN);
            } else if (board[this.id].piece == null && this.classList.contains(BEAT_ZONE)) {
                //enPassant
                turnInfo = movePiece(this.id, ENPASSANT_TURN);
            } else if (this.classList.contains(CASTLING_ZONE)) {
                turnInfo = movePiece(this.id, CASTLING_TURN);
            }
            if (turnInfo != null) {
                timer.pause();
                connection.invoke("MakeTurn", user.name, turnInfo).catch(function (err) {
                    return console.error(err.toString());
                });
                event.preventDefault();
            }
            hideTurnZones();
        } catch (e) {
            console.log(e);
        }               
    }
}

//MOVE PIECE
function movePiece(toId, turnType) { 
    var fromId = turnZones[0];
    var pieceToMove = board[fromId].piece;


    if (pieceToMove.side == user.side && pieceToMove.hasOwnProperty('isFirstTurn') && pieceToMove.isFirstTurn == true) {
        pieceToMove.isFirstTurn = false;
    }                              
    if (!(pieceToMove.value[0] == 'p' && (toId < 8 || toId > 69))) {
        showNotation(fromId, pieceToMove);
    }

    if (turnType == MOVE_TURN) {
        move();
    } else if (turnType == BEAT_TURN) {
        beat();
    } else if (turnType == ENPASSANT_TURN) {
        enPassant();
    } else if (turnType == CASTLING_TURN) {
        castling();     
    }

    var turnInfo = {
        "turnType": turnType,
        "pointA": +fromId,
        "pointB": +toId,
        "turnCount": turnsCounter,
        "isAttacked": 0,
        "isPotentiallyAttacked": false,
        "pieceToExchange": null,
        "attackedZones": [],
        "defenceZones": []
    }

    if (toId < 8 && board[toId].piece != null && board[toId].piece.value[0] == 'p') {
        exchangeInfo = {
            "fromId": +fromId,
            "turnType": turnType
        }       

        for (var i = 0; i < 4; i++) {
            var pieceToExchange = document.getElementById('pieceToExchange' + i);
            pieceToExchange.turnInfo = turnInfo;
        }
        showExchangeWindow();       
        hideTurnZones();
        throw "user select a piece...";
    }

    return turnInfo;   

    function move() {
        var from = board[fromId];
        var to = board[toId];
        var piece = from.piece;

        from.div.removeChild(piece.img);
        from.piece = null;

        to.div.appendChild(piece.img);
        to.piece = piece;   
    }
    function beat() {
        var from = board[fromId];
        var to = board[toId];
        var piece = from.piece;

        to.div.removeChild(to.piece.img);

        from.div.removeChild(piece.img);
        from.piece = null;

        to.div.appendChild(piece.img);
        to.piece = piece;
    }
    function enPassant() {
        var from = board[fromId];
        var to = board[toId];
        var toBeat = +toId > 40 ? board[+toId - 10] : board[+toId + 10];
        var piece = from.piece;

        from.div.removeChild(piece.img);
        from.piece = null;

        to.div.appendChild(piece.img);
        to.piece = piece;

        toBeat.div.removeChild(toBeat.piece.img);
        toBeat.piece = null;
    }
    function castling() {
        var king = board[fromId];
        var rook = board[toId];
        var kingPiece = king.piece;
        var rookPiece = rook.piece;

        rook.div.removeChild(rook.piece.img);
        king.div.removeChild(king.piece.img);
        rook.piece = null;
        king.piece = null;

        var newKingId;
        var newRookId;
        
        if (toId == 70 || toId == 0) {
            newKingId = +fromId - 2;
            newRookId = +fromId - 1;
        } else if (toId == 77 || toId == 7){
            newKingId = +fromId + 2;
            newRookId = +fromId + 1;
        }
        board[newKingId].div.appendChild(kingPiece.img);
        board[newKingId].piece = kingPiece;

        board[newRookId].div.appendChild(rookPiece.img);
        board[newRookId].piece = rookPiece;
    }  

    function showNotation() {
        notations.innerHTML += ' ';

        if (user.side == "white" && pieceToMove.side == user.side) {
            var x = Math.ceil((turnsCounter + 1) / 2) + '.';
            notations.innerHTML += x;
            notations.innerHTML = notations.innerHTML.replace(x, '<span style="font-weight: 700;">' + x + '</span>');
        } else if (user.side == "black" && pieceToMove.side != user.side) {
            var x = Math.ceil((turnsCounter) / 2) + '.';
            notations.innerHTML += x;
            notations.innerHTML = notations.innerHTML.replace(x, '<span style="font-weight: 700;">' + x + '</span>');
        }
       
        var fromCoord = board[fromId].div.getAttribute("name");
        var toCoord = board[toId].div.getAttribute("name");
        var fromValue = board[fromId].piece.value[0].toUpperCase();

        if (turnType == MOVE_TURN) {
            notations.innerHTML += fromValue == 'P' ? toCoord : fromValue + isMoveUnambiguity() + toCoord;
        } else if (turnType == BEAT_TURN) {
            notations.innerHTML += fromValue == 'P' ? fromCoord[0] + 'x' + toCoord : fromValue + isMoveUnambiguity() + 'x' + toCoord;
        } else if (turnType == ENPASSANT_TURN) {
            notations.innerHTML += fromCoord[0] + 'x' + toCoord;
        } else if (turnType == CASTLING_TURN) {
            notations.innerHTML += toId - fromId == -3 || toId - fromId == 3 ? "0-0" : "0-0-0";
        }

        function isMoveUnambiguity() {
            var vertical = '';
            var horizontal = '';
            var onTheSameLine = false;
            var pieceValue;

            if (fromValue == 'r') {
                pieceValue = 'r';

                ROOK_MOVE_INDEXES.forEach(i => checkLine(i));             
            } else if (fromValue == 'q') {
                pieceValue = 'q';

                QUEEN_MOVE_INDEXES.forEach(i => checkLine(i));               
            } else if (fromValue == 'b') {
                pieceValue = 'b';

                BISHOP_MOVE_INDEXES.forEach(i => checkLine(i));  
            } else if (fromValue == 'k') {
                pieceValue = 'k';

                checkPoints(toId);
            }

            if (onTheSameLine == false) {
                return "";
            } else {
                if (vertical == '' && horizontal == '') {
                    return fromCoord[0];
                }
                return vertical + horizontal;
            }

            function checkLine(step) {
                var i = +toId + step;

                while (board[i] != null) {
                    var elem = board[i];

                    if (elem.piece != null) {

                        if (elem.piece.side == board[fromId].piece.side
                            && elem.piece.value[0] == pieceValue
                            && elem.div.id != fromId) {

                            onTheSameLine = true;

                            if (fromCoord[1] == elem.div.getAttribute("name")[1]) {
                                vertical = fromCoord[0];
                            }
                            if (fromCoord[0] == elem.div.getAttribute("name")[0]) {
                                horizontal = fromCoord[1];
                            }
                            return;
                        } else {
                            return;
                        }
                    }
                    i += step;
                }

            }
            function checkPoints(id) {

                var points = [id - 19, id - 8,
                +id + 12, +id + 21,
                +id + 19, +id + 8,
                id - 12, id - 21];

                for (var i in points) {
                    var elem = board[points[i]];

                    if (elem != null) {
                        if (elem.piece != null) {
                            if (elem.piece.side == board[fromId].piece.side
                                && elem.piece.value[0] == pieceValue
                                && elem.div.id != fromId) {

                                onTheSameLine = true;

                                if (fromCoord[1] == elem.div.getAttribute("name")[1]) {
                                    vertical = fromCoord[0];
                                }
                                if (fromCoord[0] == elem.div.getAttribute("name")[0]) {
                                    horizontal = fromCoord[1];
                                }
                            }
                        }
                    }
                }
            }
        }      
    }
}


//EXCHANGE PAWN (WHEN REACH TOP LINE)
function exchangePiece(turnInfo) {
    notations.innerHTML += ' '

    var elem = board[turnInfo.pointB];
    var i = elem.piece.side == "black" ? 0 : 1;

    var fromCoord = board[turnInfo.pointA].div.getAttribute("name");
    var toCoord = board[turnInfo.pointB].div.getAttribute("name");
    var n = turnInfo.turnType == MOVE_TURN ? '' : fromCoord[0] + 'x';

    var newImg = document.createElement("img");

    switch (turnInfo.pieceToExchange) {              
        case 'r':
            newImg.src = imgSrcArr[i][0];
            newImg.id = 'r' + piecesCounter;
            if (user.side == elem.piece.side) {
                newImg.addEventListener("click", linearTurnZones, false);
            }
            break;
        case 'n':
            newImg.src = imgSrcArr[i][1];
            newImg.id = 'n' + piecesCounter;
            if (user.side == elem.piece.side) {
                newImg.addEventListener("click", knightTurnZones, false);
            }
            break;
        case 'b':
            newImg.src = imgSrcArr[i][2];
            newImg.id = 'b' + piecesCounter;
            if (user.side == elem.piece.side) {
                newImg.addEventListener("click", linearTurnZones, false);
            }
            break;
        case 'q':
            newImg.src = imgSrcArr[i][3];
            newImg.id = 'q' + piecesCounter;
            if (user.side == elem.piece.side) {
                newImg.addEventListener("click", linearTurnZones, false);
            }
            break;
    }
    piecesCounter++;
    elem.div.removeChild(elem.piece.img);
    elem.div.appendChild(newImg)
    elem.piece = {
        value: newImg.id,
        side: elem.piece.side,
        img: newImg
    }
    elem.div.style.cursor = "pointer";

    if (user.side == "white" && elem.piece.side == user.side) {
        var x = Math.ceil((turnsCounter + 1) / 2) + '.';
        notations.innerHTML += x;
        notations.innerHTML = notations.innerHTML.replace(x, '<span style="font-weight: 700;">' + x + '</span>');
    } else if (user.side == "black" && elem.piece.side != user.side) {
        var x = Math.ceil((turnsCounter) / 2) + '.';
        notations.innerHTML += x;
        notations.innerHTML = notations.innerHTML.replace(x, '<span style="font-weight: 700;">' + x + '</span>');
    }

    notations.innerHTML += n + toCoord + '=' + elem.piece.value[0].toUpperCase();
}
function showExchangeWindow() {
    document.getElementById("centralBoard").style.pointerEvents = 'none';
    var elem = document.getElementById("exchangeContainer");
    elem.classList.toggle("show");   
}
function initializeExchangeWindow() {  
    var side = user.side == "white" ? 1 : 0;
    var newMargin = document.getElementById("numbers").offsetWidth;
    var exchangeContainer = document.getElementById("exchangeContainer");
    var hideVarElem = document.getElementById("hideVariants");  
    var elems = document.getElementsByClassName("pieceImg");
    var j = 3;

    exchangeContainer.style.marginLeft = newMargin + "px";

    for (var i of elems) {
        var img = document.createElement("img");
        img.src = imgSrcArr[side][j];
        img.id = "pieceToExchange" + j;
        img.name = j;
   
        img.addEventListener("click", function (event) {
            document.getElementById("exchangeContainer").classList.toggle("show");

            var pieceToEx;

            switch (this.name) {
                case "3":
                    pieceToEx = 'q';
                    break;
                case "2":   
                    pieceToEx = 'b';
                    break;
                case "1":
                    pieceToEx = 'n';
                    break;
                case "0":
                    pieceToEx = 'r';
                    break;
            }

            var turnInfo = this.turnInfo;
            turnInfo.pieceToExchange = pieceToEx;

            exchangePiece(turnInfo);

            connection.invoke("MakeTurn", user.name, turnInfo).catch(function (err) {
                return console.error(err.toString());
            });
            event.preventDefault();
        });
        i.appendChild(img);
        j--;
    }

    hideVarElem.addEventListener("click", showHideExchangePieces);
}
function showHideExchangePieces() {
    var arrow = document.getElementById("arrow");
    arrow.innerHTML = (arrow.innerHTML === "⯇") ? "⯈" : "⯇";
    document.getElementById("exchangeVariants").classList.toggle("show");
}

//FIGURES TURN ZONES
function pawnTurnZones(event) {
    var id = this.parentNode.id;

    if (!board[id].div.classList.contains(IS_PICKED)) {
        hideTurnZones();
        turnZones[0] = id;
        board[id].div.classList.toggle(IS_PICKED);
        
        var turnState = null; //0 - standart moving, 1 - start defence, 2 - continue defence

        if (isKingAttacked > 0) {
            if (board[id].isForDefend == false && isKingAttacked < 2) {
                turnState = 1;              
            }
        } else if (board[id].isForDefend == true && isKingPotentiallyAttacked == true) {
            turnState = 2;
        } else {//simple moving
            turnState = 0;          
        }

        if (turnState != null) {
            showMoveZones();
            showBeatZones();
        }      
    }
    event.stopPropagation();

    function showMoveZones() {
        var p1 = board[id - 10];//point1
        var p2 = board[id - 20];//point2
       
        if (isEmptyPlace(p1)) {
            if (specMoveCondition(p1, turnState, id)) {
                oneCellMove(p1);
            }
            if (id[0] == 6) {
                if (isEmptyPlace(p2) && specMoveCondition(p2, turnState, id)) {
                    oneCellMove(p2);
                }
            }
        } 
        function isEmptyPlace(point) {
            if (point != null && point.piece == null) return true;
            return false;
        }  
        function oneCellMove(point) {
            point.div.classList.toggle(TURN_ZONE);
            turnZones.push(point.div.id);
        }      
    }
    function showBeatZones() {
        var e1 = board[id - 11];//enemy1
        var e2 = board[id - 9];//enemy2

        var e1EnPassant = board[id - 1];       
        var e2EnPassant = board[+id + 1];
      
        checkIfEnemy(e1, e1EnPassant);
        checkIfEnemy(e2, e2EnPassant);  

        function checkIfEnemy(enemy, enPassant) {
            if (enemy != null) {
                if (enemy.piece != null) {
                    if (enemy.piece.side != user.side && specBeatCondition(enemy, turnState, id)) {
                        enemyBeatMove(enemy);
                    }
                } else if (id[0] == 3 && enPassant.piece != null) {
                    if (enPassant.piece.value[0] == 'p'
                        && enPassant.piece.enPassant == turnsCounter
                        && specBeatCondition(enPassant, turnState, id)) {
                        enemyBeatMove(enemy);
                    }
                }
            }
        }
        function enemyBeatMove(enemy) {
            enemy.div.classList.toggle(BEAT_ZONE);
            turnZones.push(enemy.div.id);
        }
    } 
}
function linearTurnZones(event) {
    var id = this.parentNode.id;
    var moveIndexes;
    var turnState = null;//0 - standart moving, 1 - start defence, 2 - continue defence

    switch (board[id].piece.value[0]) {
        case 'r':
            if (board[id].div.classList.contains(CASTLING_ZONE)) return;
            moveIndexes = ROOK_MOVE_INDEXES;
            break;
        case 'b':
            moveIndexes = BISHOP_MOVE_INDEXES;
            break;
        case 'q':
            moveIndexes = QUEEN_MOVE_INDEXES;
            break;
    }

    if (!board[id].div.classList.contains(IS_PICKED)) {
        hideTurnZones();

        turnZones[0] = id;//access to caller id(last index);

        board[id].div.classList.toggle(IS_PICKED);

        if (isKingAttacked > 0) {
            if (board[id].isForDefend == false && isKingAttacked < 2) {
                turnState = 1;
            }
        } else if (board[id].isForDefend == true && isKingPotentiallyAttacked == true) {
            turnState = 2;
        } else {
            turnState = 0;
        }

        if (turnState != null) {
            moveIndexes.forEach(i => showTurnZones(i));
        }
    }
    event.stopPropagation();

    function showTurnZones(step) {
        var i = (+id) + step;

        while (board[i] != null) {
            if (board[i].piece == null) {
                if (specMoveCondition(board[i], turnState, id)) {
                    board[i].div.classList.toggle(TURN_ZONE);
                    turnZones.push('' + i);
                }

            } else if (board[i].piece.side != user.side) {
                if (specBeatCondition(board[i], turnState, id)) {
                    board[i].div.classList.toggle(BEAT_ZONE);
                    turnZones.push('' + i);
                }
                break;
            }
            else {
                break;
            }
            i += step;
        }        
    }
}
function knightTurnZones(event) {
    var id = this.parentNode.id;

    if (!board[id].div.classList.contains(IS_PICKED)) {
        hideTurnZones();

        turnZones[0] = id;//access to caller id(0 index);

        var turnState = null;//0 - standart moving, 1 - start defence, 2 - continue defence

        board[id].div.classList.toggle(IS_PICKED);

        var points = [id - 19, id - 8,
        +id + 12, +id + 21,
        +id + 19, +id + 8,
        id - 12, id - 21];

        if (isKingAttacked > 0) {
            if (board[id].isForDefend == false && isKingAttacked < 2) {
                turnState = 1;
            }
        } else if (isKingPotentiallyAttacked == true && board[id].isForDefend == true) {
            turnState = 2;
        } else {
            turnState = 0;          
        }

        if (turnState != null) {
            showTurnZones();
        }
    }
    event.stopPropagation();
  
    function showTurnZones() {
        for (var i in points) {
            var elem = board[points[i]];

            if (elem != null) {
                if (elem.piece == null) {
                    if (specMoveCondition(elem, turnState, id)) {
                        elem.div.classList.toggle(TURN_ZONE);
                        turnZones.push(elem.div.id);
                    }
                } else if (elem.piece.side != user.side) {
                    if (specBeatCondition(elem, turnState, id)) {
                        elem.div.classList.toggle(BEAT_ZONE);
                        turnZones.push(elem.div.id);
                    }
                }
            }
        }       
    }
}
function kingTurnZones(event) {
    var id = this.parentNode.id;

    if (!board[id].div.classList.contains(IS_PICKED)) {
        hideTurnZones();

        turnZones[0] = id;//access to caller id(last index);

        board[id].div.classList.toggle(IS_PICKED);

        var points = [id - 11, id - 10,
        id - 9, +id + 1,
        +id + 11, +id + 10,
        +id + 9, id - 1];

        for (var i in points) {
            var elem = board[points[i]];

            if (elem != null) {
                if (elem.piece == null) {
                    if (elem.isAttacked == false) {
                        elem.div.classList.toggle(TURN_ZONE);
                        turnZones.push(elem.div.id);
                    }                   
                } else if (elem.piece.side != user.side && elem.isAttacked == false) {
                    elem.div.classList.toggle(BEAT_ZONE);
                    turnZones.push(elem.div.id);
                }
            }
        }

        if (board[id].piece.isFirstTurn == true && isKingAttacked == 0) {
            if (board[70].piece != null && board[70].piece.value[0] == 'r' && board[70].piece.isFirstTurn == true) {
                if (board[id - 1].piece == null && board[id - 2].piece == null) {
                    if (board[id - 1].isAttacked == false && board[id - 2].isAttacked == false) {
                        if (id - 3 == 70 || board[id - 3].piece == null) {
                            board[70].div.classList.toggle(CASTLING_ZONE);
                            turnZones.push(board[70].div.id);
                        }
                    }
                }
            }
            if (board[77].piece != null && board[77].piece.value[0] == 'r' && board[77].piece.isFirstTurn == true) {
                if (board[+id + 1].piece == null && board[+id + 2].piece == null) {
                    if (board[+id + 1].isAttacked == false && board[+id + 2].isAttacked == false) {
                        if (+id + 3 == 77 || board[+id + 3].piece == null) {
                            board[77].div.classList.toggle(CASTLING_ZONE);
                            turnZones.push(board[77].div.id);
                        }
                    }
                }
            }
        }

    }
    event.stopPropagation();   
}

function specMoveCondition(point, turnState, id) {
    var cond = true;
    if (turnState == 1) {
        cond = (point.isForDefend == true
            && point.underAttack == kingUnderAttack);
    } else if (turnState == 2) {
        cond = (point.isForDefend == true
            && board[id].underAttack == point.underAttack);
    }
    return cond;
}
function specBeatCondition(point, turnState, id) {
    var cond = true;
    if (turnState == 1) {
        cond = (point.isForDefend == true
            && point.piece.value == kingUnderAttack);
    } else if (turnState == 2) {
        cond = (point.isForDefend == true
            && board[id].underAttack == point.piece.value);
    }
    return cond;
} 

function hideTurnZones() {
    if (turnZones.length != 0) {
        board[turnZones[0]].div.classList.toggle(IS_PICKED);

        for (var i = 1; i < turnZones.length; i++) {
            var j = turnZones[i];

            if (board[j].div.classList.contains(TURN_ZONE)) {
                board[j].div.classList.toggle(TURN_ZONE);
            } else if (board[j].div.classList.contains(BEAT_ZONE)) {
                board[j].div.classList.toggle(BEAT_ZONE);
            }

        }
        if (board[77].div.classList.contains(CASTLING_ZONE)) {
            board[77].div.classList.toggle(CASTLING_ZONE);
        }
        if (board[70].div.classList.contains(CASTLING_ZONE)) {
            board[70].div.classList.toggle(CASTLING_ZONE);
        }
        turnZones = [];
    }
}

//ON CONNECTED 
connection.on("ReceiveAvailableRooms", function (availableRooms) {
    document.getElementById("roomsContainer").classList.toggle("show");

    for (var key in availableRooms) {

        var div = CreateRoom(key, availableRooms[key]);
        document.getElementById("roomList").appendChild(div);
    }
});

//CREATE ROOM
function CreateRoom(roomName, settingsIndex) {
    var e = document.getElementById("timeControl");
    var timeSet = e.options[settingsIndex].text;

    var createdRoom = "Room " + roomName + " (" + timeSet + ").";
    var li = document.createElement("li");
    var div = document.createElement("div");

    li.textContent = createdRoom;

    div.style.marginTop = "5px";
    div.style.marginBottom = "5px";
    div.style.display = "flex";
    div.style.width = "95%";
    div.style.justifyContent = "space-between";
    div.id = roomName;

    div.appendChild(li);

    if (user.joinedRoom != roomName) {
        var btn = document.createElement("button");

        btn.innerHTML = "Join";

        btn.addEventListener("click", function (event) {

            var myExistingRoom = user.name;

            if (document.getElementById(myExistingRoom) == null) {
                connection.invoke("JoinToRoom", user.name, roomName).catch(function (err) {
                    return console.error(err.toString());
                });
                event.preventDefault();
            } else {
                alert("First, delete your room!");
            }
        });

        div.appendChild(btn);
    }

    return div;
}
document.getElementById("createRoomButton").addEventListener("click", function (event) {
    if (document.getElementById("settingsContainer").classList.contains("show")) {
        hideShowRoomSettings();
    }
    if (document.getElementById("stylesSelectors").classList.contains("show")) {
        document.getElementById("stylesSelectors").classList.toggle("show");
    }
    hideShowRoomButtons();

    var roomName = user.name;

    var e = document.getElementById("timeControl");
    var settingsIndex = e.options[e.selectedIndex].value;

    user.roomStatus = "owner";
    user.joinedRoom = roomName;

    var div = CreateRoom(roomName, settingsIndex);
    document.getElementById("roomList").appendChild(div);
    
    connection.invoke("CreateRoom", roomName, settingsIndex).catch(function (err) {
        return console.error(err.toString());
    });
    event.preventDefault();
});

connection.on("ReceiveCreatedRoom", function (roomName, settingsIndex) {
    var div = CreateRoom(roomName, settingsIndex);
    document.getElementById("roomList").appendChild(div);
});

//DELETE ROOM
document.getElementById("deleteRoomButton").addEventListener("click", function (event) {
    hideShowRoomButtons();

    var roomName = user.joinedRoom;

    user.joinedRoom = null;
    user.side = null;
    user.roomStatus = null;
    
    connection.invoke("DeleteRoom", roomName).catch(function (err) {
        return console.error(err.toString());
    });
    event.preventDefault();      
});
connection.on("ReceiveDeletedRoom", function (roomName) {
    var elementToDelete = document.getElementById(roomName);
    document.getElementById("roomList").removeChild(elementToDelete);
});

//JOIN TO ROOM
connection.on("ReceiveJoinedRoom", function (roomName, settingsIndex) {
    hideShowRoomContainer();

    if (user.roomStatus != "owner") {
        user.joinedRoom = roomName;
        user.roomStatus = "guest";
        user.side = "black";
    }
    else {
        user.side = "white";
    }

    if (settingsIndex == "0") {
        secondsLeft = 300;
    }
    else if (settingsIndex == "1") {
        secondsLeft = 900;
    }
    else {
        secondsLeft = 12600;
    }
    getCountdown(); 
});

//HIDE GIVE UP BUTTON
document.getElementById("giveUpButton").addEventListener("click", function (event) {
    var confirmGiveUp = confirm("You sure?");

    if (confirmGiveUp == true) {
        connection.invoke("CloseGameSession", { roomName: user.joinedRoom, cause: "g" }).catch(function (err) {
            return console.error(err.toString());
        });

        event.preventDefault();
    }  
});

//REFRESH GAME
document.getElementById("refreshGameButton").addEventListener("click", function (event) {
    var timerBlock = document.getElementById("gameTimer");
    var gameActions = document.getElementById("gameActions");

    timerBlock.style.backgroundColor = window.getComputedStyle(gameActions, null).getPropertyValue('background-color');

    hideShowRoomContainer();
    showRefreshGameButton();

    clearBoard();
    
    var elems = document.getElementsByClassName("pieceImg");

    var j = 3;

    for (var e of elems) {
        e.removeChild(document.getElementById('pieceToExchange' + j));
        j--;
    }
    document.getElementById("hideVariants").removeEventListener("click", showHideExchangePieces);

    var exchangeFigureDiv = document.getElementById("exchangeContainer");

    if (exchangeFigureDiv.classList.contains("show")) {
        exchangeFigureDiv.classList.toggle("show");
    }
    document.getElementById("exchangeVariants").style.pointerEvents = 'auto';

    notations.innerHTML = "";

    event.preventDefault();
});

//ROOM SETTINGS
document.getElementById("setRoomSettings").addEventListener("click", function (event) {
    hideShowRoomSettings();
    event.preventDefault();
});

//OFFER A DRAW
document.getElementById("drawButton").addEventListener("click", function (event) {
    document.getElementById("drawButton").classList.toggle("show");

    connection.invoke("DrawOffer", user.name).catch(function (err) {
        return console.error(err.toString());
    });

    event.preventDefault();
});
connection.on("ReceiveDrawOffer", function () {
    var confirmADraw = confirm("Enemy offer a draw, confirm?");

    if (confirmADraw == true) {
        connection.invoke("CloseGameSession", { roomName: user.joinedRoom, cause: "d" }).catch(function (err) {
            return console.error(err.toString());
        });

        event.preventDefault();
    }
});

window.addEventListener('beforeunload', (event) => {
    var boardCondition = JSON.stringify(board);
    localStorage.setItem("boardCondition", boardCondition);
    localStorage.setItem("notations", notations.innerText);
    localStorage.setItem("exchangeInfo", JSON.stringify(exchangeInfo));

    localStorage.setItem("styleIndexes", previousStyleIndex1 + previousStyleIndex2 + previousStyleIndex3);
    connection.stop();
});

connection.on("ReceiveReconnect", function (settings) {
    document.getElementById("gameInfo").classList.toggle("show"); 

    user.joinedRoom = settings.joinedRoom;
    user.isInTurn = settings.isInTurn;
    user.side = settings.side;
    secondsLeft = settings.time;
    if (settings.lastTurnInfo != null) {
        turnsCounter = settings.lastTurnInfo.turnsCount;
    } else turnsCounter = 0;
   
    piecesCounter = settings.piecesCounter;


    var enemyIndex = user.side == "white" ? 0 : 1;
    var myIndex = user.side == "white" ? 1 : 0;

    var retrievedBoard = localStorage.getItem("boardCondition");
    board = JSON.parse(retrievedBoard);
  
    for (var i = 0; i < 78; i++) {
        if (board[i] != null) {
            board[i].div = document.getElementById(i);
            board[i].div.addEventListener("click", pieceAction, false);
            if (board[i].piece != null) {
                switch (board[i].piece.value[0]) {
                    case "p":
                        createAndSetImg(8, 8);
                        break;
                    case "r":
                        createAndSetImg(0, 0);
                        break;
                    case "n":
                        createAndSetImg(1, 1);
                        break;
                    case "b":
                        createAndSetImg(2, 2);
                        break;  
                    case "q":
                        createAndSetImg(3, 3);
                        break;
                    case "k":
                        createAndSetImg(4, 4);
                        break;                    
                }
            }
        }
    }

    initializeExchangeWindow();

    function createAndSetImg(imgIndex, funcIndex){
        var img = document.createElement("img");
                
        if (board[i].piece.side == user.side) {
            img.src = imgSrcArr[myIndex][imgIndex];
            img.addEventListener("click", funcArr[funcIndex], false);
            img.style.cursor = "pointer";
        } else {
            img.src = imgSrcArr[enemyIndex][imgIndex];
        }       
        board[i].div.appendChild(img);      
        board[i].piece.img = img;
    }

    getCountdown();

    timer = new RecurringTimer(function () {
        if (secondsLeft < 0) {
            timer.pause();
        }
        else {
            getCountdown();
        }
    }, 1000);

    notations.innerHTML = localStorage.getItem("notations");

    var x = "1.";

    for (var i = 2; i < turnsCounter + 2; i++) {
        
        notations.innerHTML = notations.innerHTML.replace(x, '<span style="font-weight: 700;">' + x + '</span>');
        x = i + ".";
    }

    if (user.isInTurn == true) {  
        for (var i = 0; i < 8; i++) {
            if (board[i].piece != null && board[i].piece.value[0] == 'p' && board[i].piece.side == user.side) {
                var retrievedExchangeInfo = JSON.parse(localStorage.getItem("exchangeInfo"));

                var turnInfo = {
                    "turnType": retrievedExchangeInfo.turnType,
                    "pointA": +retrievedExchangeInfo.fromId,
                    "pointB": +i,
                    "turnCount": +settings.lastTurnInfo.turnsCount,
                    "isAttacked": 0,
                    "isPotentiallyAttacked": false,
                    "pieceToExchange": null,
                    "attackedZones": [],
                    "defenceZones": []
                }
                for (var i = 0; i < 4; i++) {
                    var piece = document.getElementById('pieceToExchange' + i);
                    piece.turnInfo = turnInfo;
                }
                showExchangeWindow();
                break;
            }
        }

        document.getElementById("turnInfo").innerHTML = "Your turn!";

        if (board[77 - settings.lastTurnInfo.pointA].piece != null) {
            receivePieceMove(settings.lastTurnInfo);
        }
        if (settings.lastTurnInfo.isAttacked == true && notations.innerHTML[notations.innerHTML.length - 1] != '+') {
            notations.innerHTML += "+";
        }
        document.getElementById("centralBoard").style.pointerEvents = 'auto';
    }
    else {
        document.getElementById("centralBoard").style.pointerEvents = 'none';
        timer.pause();       
        document.getElementById("turnInfo").innerHTML = "Enemy turn!";
    }

    for (var key in settings.rooms) {
        
        var div = CreateRoom(key, settings.rooms[key]);
        document.getElementById("roomList").appendChild(div);       
    }  
});

//START GAME SESSION
connection.on("ReceiveStartGameSession", function (message, isTurn) {  
    user.isInTurn = isTurn;
             
    initializeBoard();      

    document.getElementById('turnInfo').innerHTML = message;
    
    timer = new RecurringTimer(function () {
        if (secondsLeft < 0) {
            timer.pause();
        }
        else {
            getCountdown();
        }
    }, 1000);
   
    if (!isTurn) {
        timer.pause();
    }  
});

//CLOSE GAME SESSION
connection.on("ReceiveCloseGameSession", function (message, cause) {
    var boardDiv = document.getElementById("centralBoard");
    timer.pause();

    document.getElementById("exchangeVariants").style.pointerEvents = 'none';

    document.getElementById('turnInfo').innerHTML = message;
    boardDiv.style.pointerEvents = 'none';
    
    showRefreshGameButton();

    user.joinedRoom = null;
    user.side = null;
    user.roomStatus = null;
    isKingAttacked = 0;
    kingUnderAttack = null;
    isKingPotentiallyAttacked = false;
    turnsCounter = 0;


    if (document.getElementById("deleteRoomButton").classList.contains("show")) {
        hideShowRoomButtons();
    }

    var bgColor;

    switch (cause) {
        case 'w':
            bgColor = "#6DC05A";
            break;
        case 'l':
            bgColor = "#ED575E";
            break;
        case 'd':
            bgColor = "#FFFFFF";
            break;
    }
    document.getElementById('gameTimer').style.backgroundColor = bgColor;
    hideTurnZones();
});

//TIMER
function getCountdown() {
    hours = check(parseInt(secondsLeft / 3600));
    minutes = check(parseInt(secondsLeft % 3600 / 60));
    seconds = check(parseInt(secondsLeft % 3600 % 60));

    countdown.innerHTML = hours + ":" + minutes + ":" + seconds;
    secondsLeft--;
    function check(i) {
        return (i < 10 ? '0' : '') + i;
    }
}

//RECEIVE TURN
connection.on("ReceiveTurn", function (message, isTurn) {
    user.isInTurn = isTurn;

    document.getElementById('turnInfo').innerHTML = message;
    
    if (isTurn) {
        document.getElementById("centralBoard").style.pointerEvents = 'auto';
        timer.resume();
    } else {
        timer.pause();
        document.getElementById("centralBoard").style.pointerEvents = 'none';
    }    
});
connection.on("ReceiveSpecialTurn", function (i) {
    switch (i) {
        case 1:
            notations.innerHTML += '#';
            break;
        case 3:
            notations.innerHTML += '+';
            break;
    }
});


//RECEIVE PIECE MOVE
connection.on("ReceivePieceMove", function (turnInfo) {
    receivePieceMove(turnInfo)
});
function receivePieceMove(turnInfo)
{
    turnsCounter = turnInfo.turnsCount;
    isKingAttacked = turnInfo.isAttacked;
    kingUnderAttack = turnInfo.underAttack;
    isKingPotentiallyAttacked = turnInfo.isPotentiallyAttacked;

    var fromId = 77 - turnInfo.pointA;
    var toId = 77 - turnInfo.pointB;

    if (board[fromId].piece.hasOwnProperty('enPassant') && board[fromId].piece.enPassant == 0) {
        board[fromId].piece.enPassant = turnsCounter;
    }

    turnZones[0] = fromId;

    movePiece(toId, turnInfo.turnType);

    turnZones = [];

    if (turnInfo.pieceToExchange != null) {
        turnInfo.pointA = fromId;
        turnInfo.pointB = toId;
        exchangePiece(turnInfo);
    }

    for (var i = 0; i < 78; i++) {
        if (board[i] != null) {
            board[i].isAttacked = false;         
            board[i].isForDefend = false;
            board[i].underAttack = null;
        }
    }
     
    turnInfo.attackedZones.forEach(function (item) {
        board[77 - item].isAttacked = true;
    });
    
    turnInfo.defenceZones.forEach(function (item) {
        board[77 - item.id].isForDefend = true;
        board[77 - item.id].underAttack = item.underAttack;      
    });
}

//OTHER FUNCTIONS
function hideShowRoomSettings() {
    document.getElementById("settingsContainer").classList.toggle("show");
    document.getElementById("roomManipulate").classList.toggle("changeBorder");
}
function hideShowRoomContainer() {
    var drawButt = document.getElementById("drawButton");

    if (!drawButt.classList.contains("show")) {
        drawButt.classList.toggle("show");
    }  
    document.getElementById("roomsContainer").classList.toggle("show");
    document.getElementById("gameInfo").classList.toggle("show");
}
function hideShowRoomButtons() {
    document.getElementById("deleteRoomButton").classList.toggle("show");
    document.getElementById("createRoomButton").classList.toggle("show");
    document.getElementById("setRoomSettings").classList.toggle("show");
    document.getElementById("chessStyles").classList.toggle("show");
}
function showRefreshGameButton() {
    var drawButt = document.getElementById("drawButton");

    if (drawButt.classList.contains("show")) {
        drawButt.classList.toggle("show");
    }       
    document.getElementById("giveUpButton").classList.toggle("show");
    document.getElementById("refreshGameButton").classList.toggle("show");
}
function getTimeControlSettings() {
    var e = document.getElementById("timeControl");
    var timeSet = e.options[settingsIndex].text;
    return timeSet;
}
