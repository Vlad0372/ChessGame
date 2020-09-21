"use strict";

var connection = new signalR.HubConnectionBuilder()
    .withUrl("/chesshub")
    .build();

var hours, minutes, seconds;
var secondsLeft;
var countdown = document.getElementById("timer");

var imgSrcArr = [   
    ["content/images/figures/s0/rb.png", "content/images/figures/s0/nb.png",
        "content/images/figures/s0/bb.png", "content/images/figures/s0/qb.png",
        "content/images/figures/s0/kb.png", "content/images/figures/s0/bb.png",
        "content/images/figures/s0/nb.png", "content/images/figures/s0/rb.png",
        "content/images/figures/s0/pb.png"       
    ],
    ["content/images/figures/s0/rw.png", "content/images/figures/s0/nw.png",
        "content/images/figures/s0/bw.png", "content/images/figures/s0/qw.png",
        "content/images/figures/s0/kw.png", "content/images/figures/s0/bw.png",
        "content/images/figures/s0/nw.png", "content/images/figures/s0/rw.png",
        "content/images/figures/s0/pw.png"
    ]
];
var turnsCount = 0;

var turnZones = [];

const TURN_ZONE = "showTurnZone";
const BEAT_ZONE = "showBeatZone";
const CASTLING_ZONE = "showCastlingZone";
const IS_PICKED = "showIsPicked";

var board = [];

var user = {
    "name": getCookie("name"),
    "side": null,
    "joinedRoom": null,
    "isInTurn": false,
    "roomStatus": null//owner/guest
};
var funcArr = [rookTurnZones, knightTurnZones,
    bishopTurnZones, queenTurnZones,
    kingTurnZones, bishopTurnZones,
    knightTurnZones, rookTurnZones, pawnTurnZones];

var isKingAttacked = 0;
var isKingPotentiallyAttacked = false;

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
//start connection
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
//styles block
document.getElementById("stylesButton").addEventListener("click", function (event) {
    document.getElementById("stylesSelectors").classList.toggle("show");
    //document.getElementById("stylesButton").classList.toggle("changeBorder");

    event.preventDefault();
});
document.getElementById("acceptStylesButton").addEventListener("click", function (event) {
    document.getElementById("stylesSelectors").classList.toggle("show");

    var e1 = document.getElementById("colorPalette");
    var e2 = document.getElementById("boardStyles");
    var e3 = document.getElementById("figureStyles");

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
//board managment
function createBoard() {
    var k = 0;
    for (var i = 0; i < 8; i++) {        
        for (var j = 0; j < 8; j++) {
            var elem = document.getElementById(k);
            elem.addEventListener("click", figureAction, false);
            var square = {
                "div": elem,
                "isAttacked": false,
                "isForDefend": false,
                "figure": null
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
        if (board[i] != null && board[i].figure != null) {
            board[i].div.removeChild(board[i].figure.img);
            //board[i].figure = null;
            //board[i].isForDefend = false;
            //board[i].isAttacked = false;
        }
    }
    board = [];
}
function initializeBoard() {
    createBoard();

    var values = ["R1", "N1", "B1", "Q", "K", "B2", "N2", "R2"];

    var enemySide;
    var sideIndex;
    var enemySideIndex;

    if (user.side == "white") {
        enemySide = "black";
        sideIndex = 1;
        enemySideIndex = 0;
        document.getElementById("centralBoard").style.pointerEvents = 'auto';         
    } else {
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

        board[i].figure = {
            value: values[i],
            side: enemySide,
            img: img
        };
    }
    //enemy pawns row initialize
    for (var i = 10; i < 18; i++) {
        var img = document.createElement("img");
        img.src = imgSrcArr[enemySideIndex][8];

        board[i].div.appendChild(img);

        board[i].figure = {
            value: 'P' + (i - 10),
            side: enemySide,
            img: img,
            enPassant: 0
        };
    }
    
   //your pawns row initialize
    var imgId;

    for (var i = 60; i < 68; i++) {
        var img = document.createElement("img");
        img.src = imgSrcArr[sideIndex][8];
        img.style.cursor = "pointer";
        img.addEventListener("click", pawnTurnZones, false);
        imgId = 'P' + (i - 60);
        img.id = imgId;
        board[i].div.appendChild(img);
            
        board[i].figure = {
            value: imgId,
            side: user.side,
            img: img,
            enPassant: 0
        };
    }
   
    //your others row initialize
    var j;

    for (var i = 70; i < 78; i++) {
        j = i - 70;
        var img = document.createElement("img");
        img.src = imgSrcArr[sideIndex][j];
        img.style.cursor = "pointer";
        img.addEventListener("click", funcArr[j], false);
        imgId = values[j];
        img.id = imgId;

        board[i].div.appendChild(img);

        board[i].figure = {
            value: imgId,
            side: user.side,
            img: img
        };
    }
  
    initializeExchangeWindow();

    //king and rooks isFirstTurn property for castling mechanics

    if (user.side == "black") {
        //swap king and queen if user side == black
        var king = board[73];
        var queen = board[74];
        var kingFigure = king.figure;

        king.div.removeChild(king.figure.img);
        queen.div.removeChild(queen.figure.img);

        king.div.appendChild(queen.figure.img);
        queen.div.appendChild(king.figure.img);

        king.figure = queen.figure;
        queen.figure = kingFigure;

        //----------------------------------//

        var enemyKing = board[3];
        var enemyQueen = board[4];
        var enemyKingFigure = enemyKing.figure;

        enemyKing.div.removeChild(enemyKing.figure.img);
        enemyQueen.div.removeChild(enemyQueen.figure.img);

        enemyKing.div.appendChild(enemyQueen.figure.img);
        enemyQueen.div.appendChild(enemyKing.figure.img);

        enemyKing.figure = enemyQueen.figure;
        enemyQueen.figure = enemyKingFigure;

        //----------------------------------//
        king.figure.isFirstTurn = true;
        
    } else {
        board[74].figure.isFirstTurn = true;
    }

    board[70].figure.isFirstTurn = true;
    board[77].figure.isFirstTurn = true;
    
}//TEST FIGURES
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
}//to delete

function figureAction(event) {
    if (turnZones.length > 0) {
        var turnInfo = null;
        try {
            if (this.classList.contains(TURN_ZONE)) {
                turnInfo = moveFigure(this.id, "move");
            } else if (board[this.id].figure != null && this.classList.contains(BEAT_ZONE)) {
                turnInfo = moveFigure(this.id, "beat");
            } else if (board[this.id].figure == null && this.classList.contains(BEAT_ZONE)) {
                //взятие на проходе(en passan)
                turnInfo = moveFigure(this.id, "enPassan");
            } else if (this.classList.contains(CASTLING_ZONE)) {
                turnInfo = moveFigure(this.id, "castling");
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
}//INTERVAL INTERVAL INTERVAL

//move figure
function moveFigure(toId, turnType) { 
    var fromId = turnZones[0];
    var figure = board[fromId].figure;


    if (figure.side == user.side && figure.hasOwnProperty('isFirstTurn') && figure.isFirstTurn == true) {
        figure.isFirstTurn = false;
    }                              
    if (!(figure.value[0] == 'P' && (toId < 8 || toId > 69))) {
        showNotation(fromId, figure);
    }

    if (turnType == "move") {
        move();       
    } else if (turnType == "beat") {
        beat();
    } else if (turnType == "enPassan") {
        enPassan();
    } else if (turnType == "castling") {
        castling();     
    }
 
    //turnsCount++;   
    
    var turnInfo = {
        "turnType": turnType,
        "pointA": +fromId,
        "pointB": +toId,
        "turnCount": turnsCount,
        "isAttacked": 0,
        "isPotentiallyAttacked": false,
        "figureToExchange": null,
        "attackedZones": [],
        "defenceZones": []
    }

    if (toId < 8 && board[toId].figure != null && board[toId].figure.value[0] == 'P') {
        exchangeInfo = {
            "fromId": +fromId,
            "turnType": turnType
        }       

        for (var i = 0; i < 4; i++) {
            var figure = document.getElementById('figToExchange' + i);
            figure.turnInfo = turnInfo;
        }
        showExchangeWindow();       
        hideTurnZones();
        throw "user select figure...";
    }

    return turnInfo;   

    function move() {
        var from = board[fromId];
        var to = board[toId];
        var figure = from.figure;

        from.div.removeChild(figure.img);
        from.figure = null;

        to.div.appendChild(figure.img);
        to.figure = figure;   
    }
    function beat() {
        var from = board[fromId];
        var to = board[toId];
        var figure = from.figure;

        to.div.removeChild(to.figure.img);

        from.div.removeChild(figure.img);
        from.figure = null;

        to.div.appendChild(figure.img);
        to.figure = figure;
    }
    function enPassan() {
        var from = board[fromId];
        var to = board[toId];
        var toBeat = +toId > 40 ? board[+toId - 10] : board[+toId + 10];
        var figure = from.figure;

        from.div.removeChild(figure.img);
        from.figure = null;

        to.div.appendChild(figure.img);
        to.figure = figure;

        toBeat.div.removeChild(toBeat.figure.img);
        toBeat.figure = null;
    }
    function castling() {
        var king = board[fromId];
        var rook = board[toId];
        var kingFigure = king.figure;
        var rookFigure = rook.figure;

        rook.div.removeChild(rook.figure.img);
        king.div.removeChild(king.figure.img);
        rook.figure = null;
        king.figure = null;

        var newKingId;
        var newRookId;
        
        if (toId == 70 || toId == 0) {
            newKingId = +fromId - 2;
            newRookId = +fromId - 1;
        } else if (toId == 77 || toId == 7){//77
            newKingId = +fromId + 2;
            newRookId = +fromId + 1;
        }
        board[newKingId].div.appendChild(kingFigure.img);
        board[newKingId].figure = kingFigure;

        board[newRookId].div.appendChild(rookFigure.img);
        board[newRookId].figure = rookFigure;
    }  

    function showNotation() {
        notations.innerHTML += ' ';

        if (user.side == "white" && figure.side == user.side) {
            var x = Math.ceil((turnsCount + 1) / 2) + '.';
            notations.innerHTML += x;
            notations.innerHTML = notations.innerHTML.replace(x, '<span style="font-weight: 700;">' + x + '</span>');
        } else if (user.side == "black" && figure.side != user.side) {
            var x = Math.ceil((turnsCount) / 2) + '.';
            notations.innerHTML += x;
            notations.innerHTML = notations.innerHTML.replace(x, '<span style="font-weight: 700;">' + x + '</span>');
        }

        var fromCoord = board[fromId].div.getAttribute("name");
        var toCoord = board[toId].div.getAttribute("name");
        var fromValue = board[fromId].figure.value[0];

        if (turnType == "move") {
            notations.innerHTML += fromValue == 'P' ? toCoord : translateToUA(fromValue) + isMoveUnambiguity() + toCoord;
        } else if (turnType == "beat") {
            notations.innerHTML += fromValue == 'P' ? fromCoord[0] + 'x' + toCoord : translateToUA(fromValue) + isMoveUnambiguity() + 'x' + toCoord;
        } else if (turnType == "enPassan") {
            notations.innerHTML += fromCoord[0] + 'x' + toCoord;
        } else if (turnType == "castling") {
            notations.innerHTML += toId - fromId == -3 || toId - fromId == 3 ? "0-0" : "0-0-0";
        }

        function isMoveUnambiguity() {
            var vertical = '';
            var horizontal = '';
            var onTheSameLine = false;
            var figureValue;

            if (fromValue == 'R') {
                figureValue = 'R';

                checkLine(-10);
                checkLine(1);
                checkLine(10);
                checkLine(-1);
            } else if (fromValue == 'Q') {
                figureValue = 'Q';

                checkLine(-9);
                checkLine(-10);
                checkLine(11);
                checkLine(1);
                checkLine(9);
                checkLine(10);
                checkLine(-11);
                checkLine(-1);
            } else if (fromValue == 'B') {
                figureValue = 'B';

                checkLine(-9);
                checkLine(11);
                checkLine(9);
                checkLine(-11);

            } else if (fromValue == 'K') {
                figureValue = 'K';

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
            //однозначность == true

            function checkLine(step) {
                var i = +toId + step;

                while (board[i] != null) {
                    var elem = board[i];

                    if (elem.figure != null) {

                        if (elem.figure.side == board[fromId].figure.side
                            && elem.figure.value[0] == figureValue
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
                        if (elem.figure != null) {
                            if (elem.figure.side == board[fromId].figure.side
                                && elem.figure.value[0] == figureValue
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
        function translateToUA(value) {
            switch (value) {
                case 'R':
                    return 'Т';
                case 'N':
                    return 'К';
                case 'B':
                    return 'С';
                case 'Q':
                    return 'Ф';
                case 'K':
                    return 'Кр';
                default:
                    return '?';
            }
        }
    }
}//done


//change pawn figure after reach top line
function exchangeFigure(turnInfo) {
    notations.innerHTML += ' '

    var elem = board[turnInfo.pointB];
    var i = elem.figure.side == "black" ? 0 : 1;

    var fromCoord = board[turnInfo.pointA].div.getAttribute("name");
    var toCoord = board[turnInfo.pointB].div.getAttribute("name");
    var n = turnInfo.turnType == "move" ? '' : fromCoord[0] + 'x';
    var figureUA;

    var newImg = document.createElement("img");

    switch (turnInfo.figureToExchange) {              
        case 'r':
            newImg.src = imgSrcArr[i][0];
            newImg.id = 'R' + turnsCount;
            if (user.side == elem.figure.side) {
                newImg.addEventListener("click", rookTurnZones, false);
            }
            figureUA = 'Т';
            break;
        case 'n':
            newImg.src = imgSrcArr[i][1];
            newImg.id = 'N' + turnsCount;
            if (user.side == elem.figure.side) {
                newImg.addEventListener("click", knightTurnZones, false);
            }
            figureUA = 'К';
            break;
        case 'b':
            newImg.src = imgSrcArr[i][2];
            newImg.id = 'B' + turnsCount;
            if (user.side == elem.figure.side) {
                newImg.addEventListener("click", bishopTurnZones, false);
            }
            figureUA = 'С';
            break;
        case 'q':
            newImg.src = imgSrcArr[i][3];
            newImg.id = 'Q' + turnsCount;
            if (user.side == elem.figure.side) {
                newImg.addEventListener("click", queenTurnZones, false);
            }
            figureUA = 'Ф';
            break;
    }
    elem.div.removeChild(elem.figure.img);
    elem.div.appendChild(newImg)
    elem.figure = {
        value: newImg.id,
        side: elem.figure.side,
        img: newImg
    }
    elem.div.style.cursor = "pointer";

    if (user.side == "white" && elem.figure.side == user.side) {
        var x = Math.ceil((turnsCount + 1) / 2) + '.';
        notations.innerHTML += x;
        notations.innerHTML = notations.innerHTML.replace(x, '<span style="font-weight: 700;">' + x + '</span>');
    } else if (user.side == "black" && elem.figure.side != user.side) {
        var x = Math.ceil((turnsCount) / 2) + '.';
        notations.innerHTML += x;
        notations.innerHTML = notations.innerHTML.replace(x, '<span style="font-weight: 700;">' + x + '</span>');
    }

    notations.innerHTML += n + toCoord + '=' + figureUA;
}//done
function showExchangeWindow() {
    document.getElementById("centralBoard").style.pointerEvents = 'none';
    var elem = document.getElementById("exchangeContainer");
    elem.classList.toggle("show");   
}//done
function initializeExchangeWindow() {  
    var side = user.side == "white" ? 1 : 0;

    //var topLeftElem = document.getElementById("0");
    //var squareWidth = topLeftElem.offsetWidth;

    var newMargin = document.getElementById("numbers").offsetWidth;

  
    var exchangeContainer = document.getElementById("exchangeContainer");
    var hideVarElem = document.getElementById("hideVariants");

    //hideVarElem.style.height = (squareWidth + 3) + "px";
    exchangeContainer.style.marginLeft = newMargin + "px";

    
    //var gameActions = document.getElementById("gameActions");

    //exchangeContainer.style.backgroundColor = window.getComputedStyle(gameActions, null).getPropertyValue('background-color');

    var elems = document.getElementsByClassName("figureImg");

    var j = 3;

    for (var i of elems) {
        //i.style.width = (squareWidth + 3) + "px";
        //i.style.height = (squareWidth + 3) + "px";

        var img = document.createElement("img");
        img.src = imgSrcArr[side][j];
        img.id = 'figToExchange' + j;
        img.name = j;
   
        img.addEventListener("click", function (event) {
            document.getElementById("exchangeContainer").classList.toggle("show");

            var figToEx;

            switch (this.name) {
                case "3":
                    figToEx = 'q';
                    break;
                case "2":   
                    figToEx = 'b';
                    break;
                case "1":
                    figToEx = 'n';
                    break;
                case "0":
                    figToEx = 'r';
                    break;
            }

            var turnInfo = this.turnInfo;
            turnInfo.figureToExchange = figToEx;

            exchangeFigure(turnInfo);

            connection.invoke("MakeTurn", user.name, turnInfo).catch(function (err) {
                return console.error(err.toString());
            });
            event.preventDefault();
        });
        i.appendChild(img);
        j--;
    }

    hideVarElem.addEventListener("click", showHideExchangeFigures);
}//done
function showHideExchangeFigures() {
    var arrow = document.getElementById("arrow");
    arrow.innerHTML = (arrow.innerHTML === "⯇") ? "⯈" : "⯇";
    document.getElementById("exchangeVariants").classList.toggle("show");
}
//figures turn zones
function pawnTurnZones(event) {
    var id = this.parentNode.id;

    if (!board[id].div.classList.contains(IS_PICKED)) {
        hideTurnZones();

        turnZones[0] = id;

        board[id].div.classList.toggle(IS_PICKED);

        if (isKingAttacked > 0) {
            if (board[id].isForDefend == false && isKingAttacked < 2) {
                kingDefendZones();
            }
        } else if (isKingPotentiallyAttacked == true && board[id].isForDefend == true) {
            kingDefendZones();
        } else {//simple moving
            var p1 = board[id - 10];//point1

            if (id[0] != 6) {
                if (isEmptyPlace(p1)) {
                    oneCellMove(p1);
                }
            } else if (isEmptyPlace(p1)) {
                oneCellMove(p1);

                var p2 = board[id - 20];//point2

                if (isEmptyPlace(p2)) {
                    oneCellMove(p2);
                }
            }

            var e1 = board[id - 11];//enemy1
            var e2 = board[id - 9];//enemy2
            var side = board[id].figure.side;

            if (e1 != null) {
                if (e1.figure != null) {
                    if (e1.figure.side != side) {
                        enemyBeatMove(e1);
                    }
                } else if (id[0] == 3 && board[id - 1].figure != null) {
                    if (board[id - 1].figure.value[0] == 'P' && board[id - 1].figure.enPassant == turnsCount) {
                        enemyBeatMove(e1);
                    }
                }
            }
            if (e2 != null) {
                if (e2.figure != null) {
                    if (e2.figure.side != side) {
                        enemyBeatMove(e2);
                    }
                } else if (id[0] == 3 && board[+id + 1].figure != null) {
                    if (board[+id + 1].figure.value[0] == 'P' && board[+id + 1].figure.enPassant == turnsCount) {
                        enemyBeatMove(e2);
                    }
                }
            }
        }
    }
    event.stopPropagation();

    function oneCellMove(point) {
        point.div.classList.toggle(TURN_ZONE);
        turnZones.push(point.div.id);
    }
    function enemyBeatMove(enemy) {
        enemy.div.classList.toggle(BEAT_ZONE);
        turnZones.push(enemy.div.id);
    }
    function isEmptyPlace(point) {
        if (point != null && point.figure == null) return true;
        return false;
    }
    function kingDefendZones() {
        var e1 = board[id - 11];//enemy 1
        var e2 = board[id - 9];//enemy 2

        if (e1 != null) {
            if (e1.figure != null) {
                if (e1.figure.side != user.side && e1.isForDefend == true) {
                    enemyBeatMove(e1);
                }
            } else if (id[0] == 3 && board[id - 1].figure != null) {
                if (board[id - 1].isForDefend == true && board[id - 1].figure.value[0] == 'P' && board[id - 1].figure.enPassant == turnsCount) {
                    enemyBeatMove(e1);
                }
            }
        }
        if (e2 != null) {
            if (e2.figure != null) {
                if (e2.figure.side != user.side && e2.isForDefend == true) {
                    enemyBeatMove(e2);
                }
            } else if (id[0] == 3 && board[id - 1].figure != null) {
                if (board[+id + 1].isForDefend == true && board[+id + 1].figure.value[0] == 'P' && board[+id + 1].figure.enPassant == turnsCount) {
                    enemyBeatMove(e2);
                }
            }
        }
       
        var p1 = board[id - 10];//point1

        if (isEmptyPlace(p1)) {
            if (p1.isForDefend == true) {
                oneCellMove(p1);
            }            
            if (id[0] == 6) {
                var p2 = board[id - 20];//point2

                if (isEmptyPlace(p2) && p2.isForDefend == true) {
                    oneCellMove(p2);
                }
            }
        } 
    }    
}//done?
function rookTurnZones(event) {
    var id = this.parentNode.id;
    if (!board[id].div.classList.contains(CASTLING_ZONE)) {
        if (!board[id].div.classList.contains(IS_PICKED)) {
            hideTurnZones();

            turnZones[0] = id;//access to caller id(last index);

            board[id].div.classList.toggle(IS_PICKED);

            if (isKingAttacked > 0) {
                if (board[id].isForDefend == false && isKingAttacked < 2) {
                    showKingDefendZones(+id, -10);
                    showKingDefendZones(+id, 1);
                    showKingDefendZones(+id, 10);
                    showKingDefendZones(+id, -1);
                }
            } else if (isKingPotentiallyAttacked == true && board[id].isForDefend == true) {
                showKingDefendZones(+id, -10);
                showKingDefendZones(+id, 1);
                showKingDefendZones(+id, 10);
                showKingDefendZones(+id, -1);
            } else {
                showTurnZones(+id, -10);
                showTurnZones(+id, 1);
                showTurnZones(+id, 10);
                showTurnZones(+id, -1);
            }
        }
        event.stopPropagation();
    }
}//done?
function knightTurnZones(event) {
    var id = this.parentNode.id;

    if (!board[id].div.classList.contains(IS_PICKED)) {
        hideTurnZones();

        turnZones[0] = id;//access to caller id(0 index);

        board[id].div.classList.toggle(IS_PICKED);

        var points = [id - 19, id - 8,
        +id + 12, +id + 21,
        +id + 19, +id + 8,
        id - 12, id - 21];

        if (isKingAttacked > 0) {
            if (board[id].isForDefend == false && isKingAttacked < 2) {
                kingDefendZones();
            }
        } else if (isKingPotentiallyAttacked == true && board[id].isForDefend == true) {
            kingDefendZones();
        } else {

            for (var i in points) {
                var elem = board[points[i]];

                if (elem != null) {
                    if (elem.figure == null) {
                        elem.div.classList.toggle(TURN_ZONE);
                        turnZones.push(elem.div.id);
                    } else if (elem.figure.side != user.side) {
                        elem.div.classList.toggle(BEAT_ZONE);
                        turnZones.push(elem.div.id);
                    }
                }
            }
        }
    }
    event.stopPropagation();
    function kingDefendZones() {
        for (var i in points) {
            var elem = board[points[i]];

            if (elem != null) {
                if (elem.figure == null) {
                    if (elem.isForDefend == true) {
                        elem.div.classList.toggle(TURN_ZONE);
                        turnZones.push(elem.div.id);
                    }                   
                } else if (elem.figure.side != user.side) {
                    if (elem.isForDefend == true) {
                        elem.div.classList.toggle(BEAT_ZONE);
                        turnZones.push(elem.div.id);
                    }                   
                }
            }
        }
    }
}//done?
function bishopTurnZones(event) {
    var id = this.parentNode.id;

    if (!board[id].div.classList.contains(IS_PICKED)) {
        hideTurnZones();

        turnZones[0] = id;//access to caller id(last index);

        board[id].div.classList.toggle(IS_PICKED);

        if (isKingAttacked > 0) {
            if (board[id].isForDefend == false && isKingAttacked < 2) {
                showKingDefendZones(+id, -9);
                showKingDefendZones(+id, 11);
                showKingDefendZones(+id, 9);
                showKingDefendZones(+id, -11);
            }
        } else if (isKingPotentiallyAttacked == true && board[id].isForDefend == true) {
            showKingDefendZones(+id, -9);
            showKingDefendZones(+id, 11);
            showKingDefendZones(+id, 9);
            showKingDefendZones(+id, -11);
        } else {
            showTurnZones(+id, -9);
            showTurnZones(+id, 11);
            showTurnZones(+id, 9);
            showTurnZones(+id, -11);
        }      
        
    }
    
    event.stopPropagation();
}//done?
function queenTurnZones(event) {
    var id = this.parentNode.id;

    if (!board[id].div.classList.contains(IS_PICKED)) {
        hideTurnZones();

        turnZones[0] = id;//access to caller id(last index);

        board[id].div.classList.toggle(IS_PICKED);

        if (isKingAttacked > 0) {
            if (board[id].isForDefend == false && isKingAttacked < 2) {
                showKingDefendZones(+id, -10);
                showKingDefendZones(+id, -9);
                showKingDefendZones(+id, 1);
                showKingDefendZones(+id, 11);
                showKingDefendZones(+id, 10);
                showKingDefendZones(+id, 9);
                showKingDefendZones(+id, -1);               
                showKingDefendZones(+id, -11);
            }
        } else if (isKingPotentiallyAttacked == true && board[id].isForDefend == true) {
            showKingDefendZones(+id, -10);
            showKingDefendZones(+id, -9);
            showKingDefendZones(+id, 1);
            showKingDefendZones(+id, 11);
            showKingDefendZones(+id, 10);
            showKingDefendZones(+id, 9);
            showKingDefendZones(+id, -1);
            showKingDefendZones(+id, -11);
        } else {
            showTurnZones(+id, -10);
            showTurnZones(+id, -9);
            showTurnZones(+id, 1);
            showTurnZones(+id, 11);
            showTurnZones(+id, 10);
            showTurnZones(+id, 9);
            showTurnZones(+id, -1);
            showTurnZones(+id, -11);
        }
    }
    event.stopPropagation();
}//done?
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
                if (elem.figure == null) {
                    if (elem.isAttacked == false) {
                        elem.div.classList.toggle(TURN_ZONE);
                        turnZones.push(elem.div.id);
                    }                   
                } else if (elem.figure.side != user.side && elem.isAttacked == false) {
                    elem.div.classList.toggle(BEAT_ZONE);
                    turnZones.push(elem.div.id);
                }
            }
        }

        if (board[id].figure.isFirstTurn == true && isKingAttacked == 0) {
            if (board[70].figure != null && board[70].figure.value[0] == 'R' && board[70].figure.isFirstTurn == true) {
                if (board[id - 1].figure == null && board[id - 2].figure == null) {
                    if (board[id - 1].isAttacked == false && board[id - 2].isAttacked == false) {
                        if (id - 3 == 70 || board[id - 3].figure == null) {
                            board[70].div.classList.toggle(CASTLING_ZONE);
                            turnZones.push(board[70].div.id);
                        }
                    }
                }
            }
            if (board[77].figure != null && board[77].figure.value[0] == 'R' && board[77].figure.isFirstTurn == true) {
                if (board[+id + 1].figure == null && board[+id + 2].figure == null) {
                    if (board[+id + 1].isAttacked == false && board[+id + 2].isAttacked == false) {
                        if (+id + 3 == 77 || board[+id + 3].figure == null) {
                            board[77].div.classList.toggle(CASTLING_ZONE);
                            turnZones.push(board[77].div.id);
                        }
                    }
                }
            }
        }

    }
    event.stopPropagation();   
}//done?

function showTurnZones(id, step) {  
    var i = id += step;

    while (board[i] != null) {
        if (board[i].figure == null) {
            board[i].div.classList.toggle(TURN_ZONE);
            turnZones.push('' + i);

        } else if (board[i].figure.side != user.side) {
            board[i].div.classList.toggle(BEAT_ZONE);
            turnZones.push('' + i);
            break;
        }
        else {
            break;
        }
        i += step;
    }    
}//done
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
    //var time = performance.now();
    //time = performance.now() - time;
    //console.log('Время выполнения = ', time);
}//time performance example
function showKingDefendZones(id, step) {
    var i = id += step;

    while (board[i] != null) {
        if (board[i].figure == null) {
            if (board[i].isForDefend) {
                board[i].div.classList.toggle(TURN_ZONE);
                turnZones.push('' + i);
            }            

        } else if (board[i].figure.side != user.side) {
            if (board[i].isForDefend) {
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
//on connected 
connection.on("ReceiveAvailableRooms", function (availableRooms) {
    document.getElementById("roomsContainer").classList.toggle("show");

    for (var key in availableRooms) {

        var div = CreateRoom(key, availableRooms[key]);
        document.getElementById("roomList").appendChild(div);
    }
});

//create room
function CreateRoom(roomName, settingsIndex) {
    var e = document.getElementById("timeControl");
    var timeSet = e.options[settingsIndex].text;

    var createdRoom = "Кімната " + roomName + " (" + timeSet + ").";
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

        btn.innerHTML = "Увійти";

        btn.addEventListener("click", function (event) {

            var myExistingRoom = user.name;

            if (document.getElementById(myExistingRoom) == null) {
                connection.invoke("JoinToRoom", user.name, roomName).catch(function (err) {
                    return console.error(err.toString());
                });
                event.preventDefault();
            } else {
                alert("Спершу, видаліть свою кімнату!");
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

//delete room
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

//join to room
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

//give up HIDE BUTTON
document.getElementById("giveUpButton").addEventListener("click", function (event) {
    var confirmGiveUp = confirm("Ви впевнені, що хочете здатись?");

    if (confirmGiveUp == true) {
        connection.invoke("CloseGameSession", { roomName: user.joinedRoom, cause: "g" }).catch(function (err) {
            return console.error(err.toString());
        });

        event.preventDefault();
    }  
});

//refresh game
document.getElementById("refreshGameButton").addEventListener("click", function (event) {

    //document.getElementById("centralBoard").style.border = "solid 2px black";
    var timerBlock = document.getElementById("gameTimer");
    var gameActions = document.getElementById("gameActions");

    timerBlock.style.backgroundColor = window.getComputedStyle(gameActions, null).getPropertyValue('background-color');

    hideShowRoomContainer();
    showRefreshGameButton();

    clearBoard();
    
    var elems = document.getElementsByClassName("figureImg");

    var j = 3;

    for (var e of elems) {
        e.removeChild(document.getElementById('figToExchange' + j));
        j--;
    }
    document.getElementById("hideVariants").removeEventListener("click", showHideExchangeFigures);

    var exchangeFigureDiv = document.getElementById("exchangeContainer");

    if (exchangeFigureDiv.classList.contains("show")) {
        exchangeFigureDiv.classList.toggle("show");
    }
    document.getElementById("exchangeVariants").style.pointerEvents = 'auto';

    notations.innerHTML = "";

    event.preventDefault();
});

//room settings
document.getElementById("setRoomSettings").addEventListener("click", function (event) {
    hideShowRoomSettings();
    event.preventDefault();
});

//offer a draw
document.getElementById("drawButton").addEventListener("click", function (event) {
    document.getElementById("drawButton").classList.toggle("show");

    connection.invoke("DrawOffer", user.name).catch(function (err) {
        return console.error(err.toString());
    });

    event.preventDefault();
});
connection.on("ReceiveDrawOffer", function () {
    var confirmADraw = confirm("Противник пропонує нічию, погоджуєтесь?");

    if (confirmADraw == true) {
        connection.invoke("CloseGameSession", { roomName: user.joinedRoom, cause: "d" }).catch(function (err) {
            return console.error(err.toString());
        });

        event.preventDefault();
    }
});
//reconnect
//connection.onclose(() => {  
//    localStorage.setItem('hello', "hello");
//});
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
    turnsCount = settings.lastTurnInfo.turnsCount;

    var enemyIndex = user.side == "white" ? 0 : 1;
    var myIndex = user.side == "white" ? 1 : 0;

    var retrievedBoard = localStorage.getItem("boardCondition");
    board = JSON.parse(retrievedBoard);
  
    for (var i = 0; i < 78; i++) {
        if (board[i] != null) {
            board[i].div = document.getElementById(i);
            board[i].div.addEventListener("click", figureAction, false);
            if (board[i].figure != null) {
                switch (board[i].figure.value[0]) {
                    case "P":
                        createAndSetImg(8, 8);
                        break;
                    case "R":
                        createAndSetImg(0, 0);
                        break;
                    case "N":
                        createAndSetImg(1, 1);
                        break;
                    case "B":
                        createAndSetImg(2, 2);
                        break;  
                    case "Q":
                        createAndSetImg(3, 3);
                        break;
                    case "K":
                        createAndSetImg(4, 4);
                        break;                    
                }
            }
        }
    }

    initializeExchangeWindow();

    function createAndSetImg(imgIndex, funcIndex){
        var img = document.createElement("img");
                
        if (board[i].figure.side == user.side) {
            img.src = imgSrcArr[myIndex][imgIndex];
            img.addEventListener("click", funcArr[funcIndex], false);
            img.style.cursor = "pointer";
        } else {
            img.src = imgSrcArr[enemyIndex][imgIndex];
        }       
        board[i].div.appendChild(img);      
        board[i].figure.img = img;
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

    for (var i = 2; i < turnsCount + 2; i++) {
        
        notations.innerHTML = notations.innerHTML.replace(x, '<span style="font-weight: 700;">' + x + '</span>');
        x = i + ".";
    }

    if (user.isInTurn == true) {  
        for (var i = 0; i < 8; i++) {
            if (board[i].figure != null && board[i].figure.value[0] == 'P' && board[i].figure.side == user.side) {
                var retrievedExchangeInfo = JSON.parse(localStorage.getItem("exchangeInfo"));

                var turnInfo = {
                    "turnType": retrievedExchangeInfo.turnType,
                    "pointA": +retrievedExchangeInfo.fromId,
                    "pointB": +i,
                    "turnCount": +settings.lastTurnInfo.turnsCount,
                    "isAttacked": 0,
                    "isPotentiallyAttacked": false,
                    "figureToExchange": null,
                    "attackedZones": [],
                    "defenceZones": []
                }
                for (var i = 0; i < 4; i++) {
                    var figure = document.getElementById('figToExchange' + i);
                    figure.turnInfo = turnInfo;
                }
                showExchangeWindow();
                break;
            }
        }

        document.getElementById("turnInfo").innerHTML = "Ваш хід!";

        if (board[77 - settings.lastTurnInfo.pointA].figure != null) {
            receiveFigureMove(settings.lastTurnInfo);
        }
        if (settings.lastTurnInfo.isAttacked == true && notations.innerHTML[notations.innerHTML.length - 1] != '+') {
            notations.innerHTML += "+";
        }
        document.getElementById("centralBoard").style.pointerEvents = 'auto';
    }
    else {
        document.getElementById("centralBoard").style.pointerEvents = 'none';
        timer.pause();       
        document.getElementById("turnInfo").innerHTML = "Хід противника!";
    }

    for (var key in settings.rooms) {
        
        var div = CreateRoom(key, settings.rooms[key]);
        document.getElementById("roomList").appendChild(div);       
    }

    //showInfoMessage("Ви перепідключились!");   
});
//start game session
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
    
    //showInfoMessage(message);
});

//close game session
connection.on("ReceiveCloseGameSession", function (message, cause) {
    var boardDiv = document.getElementById("centralBoard");
    timer.pause();

    document.getElementById("exchangeVariants").style.pointerEvents = 'none';

    document.getElementById('turnInfo').innerHTML = message;
    boardDiv.style.pointerEvents = 'none';
    
    //border: solid 2px black;

    showRefreshGameButton();

    user.joinedRoom = null;
    user.side = null;
    user.roomStatus = null;
    isKingAttacked = 0;
    isKingPotentiallyAttacked = false;
    turnsCount = 0;


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

    //showInfoMessage(message);
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
//make turn
function getCountdown() {
    hours = check(parseInt(secondsLeft / 3600));
    minutes = check(parseInt(secondsLeft % 3600 / 60));
    seconds = check(parseInt(secondsLeft % 3600 % 60));

    // строка обратного отсчета  + значение тега
    countdown.innerHTML = hours + ":" + minutes + ":" + seconds;
    secondsLeft--;
}
function check(i) {
    return (i < 10 ? '0' : '') + i;
}

connection.on("ReceiveTurn", function (message, isTurn) {
    user.isInTurn = isTurn;
    //showInfoMessage(message);

    document.getElementById('turnInfo').innerHTML = message;
    
    if (isTurn) {
        document.getElementById("centralBoard").style.pointerEvents = 'auto';
        timer.resume();
    } else {
        timer.pause();
        document.getElementById("centralBoard").style.pointerEvents = 'none';
    }    
});
//timer

//receive figure move
connection.on("ReceiveFigureMove", function (turnInfo) {
    receiveFigureMove(turnInfo)
});
function receiveFigureMove(turnInfo) {
    turnsCount = turnInfo.turnsCount;
    isKingAttacked = turnInfo.isAttacked;
    isKingPotentiallyAttacked = turnInfo.isPotentiallyAttacked;

    var fromId = 77 - turnInfo.pointA;
    var toId = 77 - turnInfo.pointB;

    if (board[fromId].figure.hasOwnProperty('enPassant') && board[fromId].figure.enPassant == 0) {
        board[fromId].figure.enPassant = turnsCount;
    }

    turnZones[0] = fromId;

    moveFigure(toId, turnInfo.turnType);

    turnZones = [];

    if (turnInfo.figureToExchange != null) {
        turnInfo.pointA = fromId;
        turnInfo.pointB = toId;
        exchangeFigure(turnInfo);
    }

    for (var i = 0; i < 78; i++) {
        if (board[i] != null) {
            board[i].isAttacked = false;
            board[i].isForDefend = false;
        }
    }

    turnInfo.attackedZones.forEach(function (item, i) {
        board[77 - item].isAttacked = true;
    });
    turnInfo.defenceZones.forEach(function (item, i) {
        board[77 - item].isForDefend = true;
    });
    //attackedZones.forEach(element => board[77 - element].isAttacked = true);
    //defenceZones.forEach(element => board[77 - element].isForDefend = true);
}

//other functions
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
function showInfoMessage(message) {
    var li = document.createElement("li");
    li.textContent = message;
    document.getElementById("messagesList").appendChild(li);
}
function getTimeControlSettings() {
    var e = document.getElementById("timeControl");
    var timeSet = e.options[settingsIndex].text;
    return timeSet;
}
