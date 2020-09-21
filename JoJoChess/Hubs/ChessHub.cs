using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;
using System.Threading;
using System.Reflection;

//using System.Diagnostics;
//var sw = new Stopwatch();
//sw.Start();
//sw.Stop();
//Console.WriteLine("Time:" + sw.ElapsedMilliseconds);

namespace JoJoChess.Hubs
{
    public class ChessHub : Hub
    {
        public static Dictionary<string, GuestUser> guestList = new Dictionary<string, GuestUser>();
        public static Dictionary<string, Room> roomList = new Dictionary<string, Room>();
        public static List<string> connectionList = new List<string>();
        public static Dictionary<string, string> availableRoomList = new Dictionary<string, string>();
        public static Dictionary<string, Timer> timerList = new Dictionary<string, Timer>();

        IHubContext<ChessHub> _hubContext = null;
        public ChessHub(IHubContext<ChessHub> hubContext)
        {
            _hubContext = hubContext;
        }
        public override async Task OnConnectedAsync()
        {
            var currConnectionId = Context.ConnectionId;
            var context = Context.GetHttpContext();

            connectionList.Add(currConnectionId);

            string currCookieId;
            //string toCallerMessage;
            //string toOthersMessage;

            if (context.Request.Cookies.TryGetValue("name", out currCookieId))
            {
                GuestUser currentUser;

                if (!guestList.TryGetValue(currCookieId, out currentUser))
                {
                    var newUser = new GuestUser(currConnectionId, currCookieId);

                    guestList.Add(currCookieId, newUser);

                    await Clients.Caller.SendAsync("ReceiveAvailableRooms", availableRoomList);

                    //toCallerMessage = "Привіт новий Гість!";
                    //toOthersMessage = "Новий гість під'єднався!";
                }
                else if (currentUser.JoinedRoom != null)
                {
                    currentUser.SetConnectionId(currConnectionId);
                    await ReconnectToRoom(currentUser);
                    //toCallerMessage = "Ви перепідключились до кімнати!";
                    //toOthersMessage = "Користувач перепідключився в кімнату!";
                }
                else
                {
                    currentUser.SetConnectionId(currConnectionId);
                    //toCallerMessage = "???";
                    //toOthersMessage = "???";
                }
            }
            else
            {
                //toCallerMessage = "КУКІ НЕ ВСТАНОВЛЕНО, ВСТАНОВІТЬ КУКІ!";
                //toOthersMessage = "один з користувачів без кукі";               
            }

            //await Clients.Caller.SendAsync("ReceiveInfoMessage", toCallerMessage);
            //await Clients.Others.SendAsync("ReceiveInfoMessage", toOthersMessage);         

            await base.OnConnectedAsync();
        }
        public override async Task OnDisconnectedAsync(Exception exception)
        {
            connectionList.Remove(Context.ConnectionId);

            var context = Context.GetHttpContext();

            string currCookieId;

            if (context.Request.Cookies.TryGetValue("name", out currCookieId))
            {
                GuestUser currentUser;

                if (guestList.TryGetValue(currCookieId, out currentUser))
                {
                    //rooms are named as their ovners guest name(guest name - CookieId)
                    if (currentUser.JoinedRoom == null)
                    {
                        guestList.Remove(currCookieId);

                        if (roomList.ContainsKey(currCookieId))
                        {
                            await DeleteRoom(currCookieId);
                        }
                    }
                    else
                    {
                        await Groups.RemoveFromGroupAsync(currentUser.ConnectionId, currentUser.JoinedRoom.Name);
                    }
                }
            }

            //string disconnectMessage = "Гість від'єднався!";

            //await Clients.Others.SendAsync("ReceiveInfoMessage", disconnectMessage);
            await base.OnDisconnectedAsync(exception);
        }
        //ROOMS
        public async Task CreateRoom(string roomName, string settingsIndex)
        {
            GuestUser firstPlayer;

            if (guestList.TryGetValue(roomName, out firstPlayer))
            {
                var newRoom = new Room(roomName, firstPlayer, settingsIndex);

                roomList.Add(roomName, newRoom);
                availableRoomList.Add(roomName, settingsIndex);

                await Clients.Others.SendAsync("ReceiveCreatedRoom", roomName, settingsIndex);

                await Groups.AddToGroupAsync(Context.ConnectionId, roomName);

                //await Clients.Caller.SendAsync("ReceiveInfoMessage", $"Ви щойно створили кімнату {roomName}.");
            }
        }
        public async Task DeleteRoom(string roomName)
        {
            Room roomToDelete;

            if (roomList.TryGetValue(roomName, out roomToDelete))
            {
                if (roomToDelete.FirstPlayer != null)
                {
                    await Groups.RemoveFromGroupAsync(roomToDelete.FirstPlayer.ConnectionId, roomName);
                }
                if (roomToDelete.SecondPlayer == null)
                {
                    availableRoomList.Remove(roomName);
                }
                else//if second player is not in the room, room is available
                {
                    await Groups.RemoveFromGroupAsync(roomToDelete.SecondPlayer.ConnectionId, roomName);
                }

                roomList.Remove(roomName);

                await Clients.All.SendAsync("ReceiveDeletedRoom", roomName);
            }
        }

        public async Task JoinToRoom(string user, string roomName)
        {
            if (availableRoomList.ContainsKey(roomName))
            {
                availableRoomList.Remove(roomName);

                Room oldEmptyRoom;

                if (roomList.TryGetValue(roomName, out oldEmptyRoom))
                {
                    GuestUser secondPlayer;

                    if (guestList.TryGetValue(user, out secondPlayer))
                    {
                        oldEmptyRoom.SetSecondPlayer(secondPlayer);

                        await Groups.AddToGroupAsync(Context.ConnectionId, roomName);

                        //await Clients.Group(roomName).SendAsync("ReceiveInfoMessage", $"{secondPlayer.CookieId} Увійшов до кімнати {roomName}.");
                        await Clients.All.SendAsync("ReceiveDeletedRoom", roomName);
                        await Clients.Group(roomName).SendAsync("ReceiveJoinedRoom", roomName, oldEmptyRoom.SettingsIndex);

                        //game session start
                        await StartSession(roomName);
                    }
                }
            }
        }

        //breakpoint
        public async Task StartSession(string roomName)
        {
            var currentRoom = roomList[roomName];

            var fp = currentRoom.FirstPlayer;
            var sp = currentRoom.SecondPlayer;

            fp.SetEnemy(sp);
            sp.SetEnemy(fp);

            fp.SetJoinedRoom(currentRoom);
            sp.SetJoinedRoom(currentRoom);

            fp.SetSide("white");
            sp.SetSide("black");


            if (currentRoom.SettingsIndex == "0")//БЛІЦ
            {
                fp.SetTotalTime(300);
                sp.SetTotalTime(300);
            }
            else if (currentRoom.SettingsIndex == "1")//РАПІД
            {
                fp.SetTotalTime(900);
                sp.SetTotalTime(900);
            }
            else//КЛАСИКА
            {
                fp.SetTotalTime(12600);
                sp.SetTotalTime(12600);
            }

            fp.SetIsInTurn(true);
            sp.SetIsInTurn(false);

            for (int i = 0; i < 18; i++)
            {
                if (i == 8)
                {
                    i = 10;
                }
                sp.RemainingFigures.Add(currentRoom.Board[i].Figure);
            }
            for (int i = 60; i < 78; i++)
            {
                if (i == 68)
                {
                    i = 70;
                }
                fp.RemainingFigures.Add(currentRoom.Board[i].Figure);
            }

            await Clients.Client(fp.ConnectionId).SendAsync("ReceiveStartGameSession", "Ваш хід!", true);
            await Clients.Client(sp.ConnectionId).SendAsync("ReceiveStartGameSession", "Хід противника!", false);

            Timer sessionTimer = null;
           
            sessionTimer = new Timer(new TimerCallback(async y =>
            {
                if (fp.TimeRemain != 1 && sp.TimeRemain != 1)
                {
                    if (fp.IsInTurn)
                    {
                        fp.ReduceTime();

                        //Console.WriteLine("first" + fp.TimeRemain);
                    }
                    else
                    {
                        sp.ReduceTime();

                       // Console.WriteLine("second" + sp.TimeRemain);
                    }
                }
                else
                {
                    string winnerId;
                    string loserId;

                    if (fp.TimeRemain > sp.TimeRemain)
                    {
                        winnerId = fp.ConnectionId;
                        loserId = sp.ConnectionId;
                    }
                    else
                    {
                        winnerId = sp.ConnectionId;
                        loserId = fp.ConnectionId;
                    }

                    CloseGameSession(new CloseSessionRequest { RoomName = roomName, Cause = "t", WinnerId = winnerId });
                    //Console.WriteLine("game session " + roomName + " is closed");
                }

            }), null, 0, 1000);

            timerList.Add(roomName, sessionTimer);
        }

        public async Task ReconnectToRoom(GuestUser guestUser)
        {
            await Groups.AddToGroupAsync(guestUser.ConnectionId, guestUser.JoinedRoom.Name);

            var reconnectSettings = new
            {
                rooms = availableRoomList,
                joinedRoom = guestUser.JoinedRoom.Name,
                isInTurn = guestUser.IsInTurn,
                time = guestUser.TimeRemain,
                side = guestUser.Side,
                lastTurnInfo = guestUser.JoinedRoom.LastTurnInfo
            };

            await Clients.Caller.SendAsync("ReceiveReconnect", reconnectSettings);
        }
        public async Task CloseGameSession(CloseSessionRequest req)
        {
            Room roomToClose;

            if (roomList.TryGetValue(req.RoomName, out roomToClose))
            {
                timerList[roomToClose.Name].Dispose();
                timerList.Remove(roomToClose.Name);
                
                var firstPlayer = roomToClose.FirstPlayer;
                var secondPlayer = roomToClose.SecondPlayer;

                if (req.WinnerId == null)
                {
                    req.WinnerId = firstPlayer.ConnectionId == Context.ConnectionId ? secondPlayer.ConnectionId : firstPlayer.ConnectionId;
                }

                string message1 = "";
                string message2 = "";
                string winnerCause = "w";
                string loserCause = "l";

                switch (req.Cause)
                {
                    case "t":
                        message1 = "Перемога по часу.";
                        message2 = "Поразка по часу.";
                        break;

                    case "d":
                        message1 = "Нічия.";
                        message2 = "Нічия.";
                        winnerCause = "d";
                        loserCause = "d";
                        break;

                    case "w":
                        message1 = "Ви поставили мат.";
                        message2 = "Вам поставили мат.";
                        break;

                    case "g":
                        message1 = "Здача противника.";
                        message2 = "Ви здалися.";
                        break;

                    case "p":
                        message1 = "Нічия, пат.";
                        message2 = "Нічия, пат.";
                        winnerCause = "d";
                        loserCause = "d";
                        break;
                }

                await _hubContext.Clients.Client(req.WinnerId).SendAsync("ReceiveCloseGameSession", message1, winnerCause);
                await _hubContext.Clients.GroupExcept(roomToClose.Name, req.WinnerId).SendAsync("ReceiveCloseGameSession", message2, loserCause);

                roomList.Remove(roomToClose.Name);

                firstPlayer.SetJoinedRoom(null);
                secondPlayer.SetJoinedRoom(null);

                firstPlayer.SetIsInTurn(false);
                secondPlayer.SetIsInTurn(false);

                firstPlayer.Enemy = null;
                secondPlayer.Enemy = null;

                firstPlayer.RemainingFigures.Clear();
                secondPlayer.RemainingFigures.Clear();

                firstPlayer.TimeRemain = 0;
                secondPlayer.TimeRemain = 0;

                await _hubContext.Groups.RemoveFromGroupAsync(firstPlayer.ConnectionId, req.RoomName);
                await _hubContext.Groups.RemoveFromGroupAsync(secondPlayer.ConnectionId, req.RoomName);
                //await Groups.RemoveFromGroupAsync(firstPlayer.ConnectionId, req.RoomName);
                //await Groups.RemoveFromGroupAsync(secondPlayer.ConnectionId, req.RoomName);

                //after timer is end
                if (!connectionList.Contains(firstPlayer.ConnectionId))//if player not online when game is end
                {
                    guestList.Remove(firstPlayer.CookieId);
                }
                if (!connectionList.Contains(secondPlayer.ConnectionId))
                {
                    guestList.Remove(secondPlayer.CookieId);
                }
            }
        }
        public async Task DrawOffer(string playerName)
        {
            var player = guestList[playerName];

            if (player != null && player.ConnectionId == Context.ConnectionId)//validate user
            {
                await Clients.OthersInGroup(player.JoinedRoom.Name).SendAsync("ReceiveDrawOffer");
            }
        }
        public async Task MakeTurn(string playerName, TurnInfo turnInfo)
        {
            var player = guestList[playerName];

            Room room = player.JoinedRoom;

            if (player != null && player.ConnectionId == Context.ConnectionId && player.IsInTurn == true)//validate user
            {
                var board = room.Board;

                bool isTurnCorrect = false;
                //var attackedZones = new List<int>();
                //var defenceZones = new List<int>();
                var checkmate = false;
                var stalemate = false;
                var check = false;

                room.TurnsCount++;
                turnInfo.TurnsCount = room.TurnsCount;

                try
                {
                    if (player.Side == board[turnInfo.PointA].Figure.Details.Side)
                    {
                        if (board[turnInfo.PointB].Figure.Value != ' ')//перевірка en passan
                        {
                            player.Enemy.RemainingFigures.Remove(board[turnInfo.PointB].Figure);
                        }

                        var enemyKing = board[turnInfo.PointA].Figure.Details.EnemyKing;
                        isTurnCorrect = board[turnInfo.PointA].Figure.ValidateTurn(turnInfo);

                        for (int i = 0; i < 78; i++)//clearing board beat zones
                        {
                            if (board[i] != null)
                            {
                                board[i].IsAttacked = false;
                                board[i].IsForDefend = false;
                            }
                        }

                        enemyKing.IsAttacked = 0;
                        enemyKing.IsPotentiallyAttacked = false;

                        foreach (IFigure figure in player.RemainingFigures)//setting new beat zones
                        {
                            figure.SetBeatZones();
                        }

                        turnInfo.IsAttacked = enemyKing.IsAttacked;
                        turnInfo.IsPotentiallyAttacked = enemyKing.IsPotentiallyAttacked;

                        for (int i = 0; i < 78; i++)//beat zones array for client
                        {
                            if (board[i] != null)
                            {
                                if (board[i].IsAttacked == true)
                                {
                                    turnInfo.AttackedZones.Add(i);
                                }
                                if (board[i].IsForDefend == true)
                                {
                                    turnInfo.DefenceZones.Add(i);
                                }

                            }
                        }

                        Array.Reverse(board);

                        int availableMovesAmount = 0;
                        //int defenceMovesAmount = 0;

                        foreach (IFigure figure in player.Enemy.RemainingFigures)
                        {
                            if (enemyKing.IsAttacked > 0)
                            {
                                if (board[figure.Position].IsForDefend == false && enemyKing.IsAttacked < 2)
                                {
                                    availableMovesAmount += figure.IsMovePossible("defence");
                                }
                                else if (enemyKing.IsAttacked > 1)
                                {
                                    availableMovesAmount += enemyKing.IsMovePossible();
                                }
                            }
                            else if (enemyKing.IsPotentiallyAttacked == true && board[figure.Position].IsForDefend == true)
                            {
                                availableMovesAmount += figure.IsMovePossible("defence");
                            }
                            else
                            {
                                availableMovesAmount += figure.IsMovePossible();
                            }

                        }


                        if (enemyKing.IsAttacked > 0)
                        {
                            check = true;
                            if (availableMovesAmount == 0) checkmate = true;
                        }
                        else if (availableMovesAmount == 0)
                        {
                            stalemate = true;
                        }

                    }
                }
                catch (Exception ex)
                {
                    //Console.WriteLine(ex.ToString());
                    //Console.WriteLine(ex.InnerException);
                    //Console.WriteLine(ex.StackTrace);
                    Console.WriteLine(ex.Message);
                }

                if (isTurnCorrect == true)
                {
                    room.LastTurnInfo = turnInfo;
                    await Clients.OthersInGroup(room.Name).SendAsync("ReceiveFigureMove", turnInfo);
                    await SwitchWhoseTurn(room.Name);

                    if (checkmate == true)
                    {

                        await Clients.Group(room.Name).SendAsync("ReceiveSpecialTurn", 1);
                        await CloseGameSession(new CloseSessionRequest { RoomName = room.Name, Cause = "w", WinnerId = player.ConnectionId });
                        //await Clients.Caller.SendAsync("ReceiveCloseGameSession", "Гра закінчилась!", "w");
                        //wait Clients.OthersInGroup(room.Name).SendAsync("ReceiveCloseGameSession", "Гра закінчилась!", "l");
                    }
                    else if (stalemate == true)
                    {
                        await Clients.Group(room.Name).SendAsync("ReceiveSpecialTurn", 2);
                        await CloseGameSession(new CloseSessionRequest { RoomName = room.Name, Cause = "p", WinnerId = null });
                        //await Clients.Group(room.Name).SendAsync("ReceiveCloseGameSession", "Гра закінчилась!", "d");
                    }
                    else if (check == true)
                    {
                        await Clients.Group(room.Name).SendAsync("ReceiveSpecialTurn", 3);
                    }
                    //todelete
                    //await Clients.Group(room.Name).SendAsync("ReceiveCloseGameSession", "Гра закінчилась!", "w");
                }
                else
                {
                    Console.WriteLine("TURN ERROR");
                    await Clients.Group(room.Name).SendAsync("ReceiveInfoMessage", "TURN ERROR");
                }
            }
            else
            {
                await Clients.Group(room.Name).SendAsync("ReceiveInfoMessage", "USER ERROR");
            }
        }//!!!
        public async Task SwitchWhoseTurn(string roomName)
        {
            Room room;

            if (roomList.TryGetValue(roomName, out room))
            {
                if (room.FirstPlayer.IsInTurn)
                {
                    room.FirstPlayer.SetIsInTurn(false);
                    room.SecondPlayer.SetIsInTurn(true);

                    await Clients.Client(room.FirstPlayer.ConnectionId).SendAsync("ReceiveTurn", "Хід противника!", false);
                    await Clients.Client(room.SecondPlayer.ConnectionId).SendAsync("ReceiveTurn", "Ваш хід!", true);
                }
                else
                {
                    room.FirstPlayer.SetIsInTurn(true);
                    room.SecondPlayer.SetIsInTurn(false);

                    await Clients.Client(room.FirstPlayer.ConnectionId).SendAsync("ReceiveTurn", "Ваш хід!", true);
                    await Clients.Client(room.SecondPlayer.ConnectionId).SendAsync("ReceiveTurn", "Хід противника!", false);
                }
            }
        }//set who has a turn now           
    }


    //breakpoint
    public class Room
    {
        public string Name { get; set; }
        public GuestUser FirstPlayer { get; set; }
        public GuestUser SecondPlayer { get; set; }
        public string SettingsIndex { get; set; }
        public Square[] Board { get; set; }
        public int TurnsCount { get; set; }       
        public TurnInfo LastTurnInfo { get; set; }

        public Room(string roomName, GuestUser firstPlayer, string settingsIndex)
        {
            var k1 = new King(73);
            var k2 = new King(74);

            var d1 = new GameDetails
            {
                Side = "black",
                EnemySide = "white",
                King = k1,
                EnemyKing = k2,
                RoomName = roomName
            };
            var d2 = new GameDetails
            {
                Side = "white",
                EnemySide = "black",
                King = k2,
                EnemyKing = k1,
                RoomName = roomName
            };

            k1.Details = d1;
            k2.Details = d2;

            Name = roomName;
            FirstPlayer = firstPlayer;
            SecondPlayer = null;
            SettingsIndex = settingsIndex;
            TurnsCount = 0;
            Board = new Square[78]
            {
                      new Square(new Rook(77, d1)), new Square(new Knight(76, d1)), new Square(new Bishop(75, d1)), new Square(new Queen(74, d1)), new Square(k1), new Square(new Bishop(72, d1)), new Square(new Knight(71, d1)), new Square(new Rook(70, d1)), null,
                null, new Square(new Pawn(67, d1)), new Square(new Pawn(66, d1)), new Square(new Pawn(65, d1)), new Square(new Pawn(64, d1)), new Square(new Pawn(63, d1)), new Square(new Pawn(62, d1)), new Square(new Pawn(61, d1)), new Square(new Pawn(60, d1)), null,
                null, new Square(), new Square(), new Square(), new Square(), new Square(), new Square(), new Square(), new Square(), null,
                null, new Square(), new Square(), new Square(), new Square(), new Square(), new Square(), new Square(), new Square(), null,
                null, new Square(), new Square(), new Square(), new Square(), new Square(), new Square(), new Square(), new Square(), null,
                null, new Square(), new Square(), new Square(), new Square(), new Square(), new Square(), new Square(), new Square(), null,
                null, new Square(new Pawn(60, d2)), new Square(new Pawn(61, d2)), new Square(new Pawn(62, d2)), new Square(new Pawn(63, d2)), new Square(new Pawn(64, d2)), new Square(new Pawn(65, d2)), new Square(new Pawn(66, d2)), new Square(new Pawn(67, d2)), null,
                null, new Square(new Rook(70, d2)), new Square(new Knight(71, d2)), new Square(new Bishop(72, d2)), new Square(new Queen(73, d2)), new Square(k2), new Square(new Bishop(75, d2)), new Square(new Knight(76, d2)), new Square(new Rook(77, d2))
            };
            LastTurnInfo = null;

            for (int i = 0; i < 8; i++)
            {
                Board[i].Figure.Board = Board;
            }
            for (int i = 10; i < 18; i++)
            {
                Board[i].Figure.Board = Board;
            }
            for (int i = 60; i < 68; i++)
            {
                Board[i].Figure.Board = Board;
            }
            for (int i = 70; i < 78; i++)
            {
                Board[i].Figure.Board = Board;
            }
        }

        public void SetFirstPlayer(GuestUser fp)
        {
            this.FirstPlayer = fp;
        }
        public void SetSecondPlayer(GuestUser sp)
        {
            this.SecondPlayer = sp;
        }
    }
    public class GuestUser
    {
        public string ConnectionId { get; set; }
        public string CookieId { get; set; }
        public Room JoinedRoom { get; set; }
        public bool IsInTurn { get; set; }
        public int TimeRemain { get; set; }
        public string Side { get; set; }
        public GuestUser Enemy { get; set; }
        public List<IFigure> RemainingFigures { get; set; }

        public GuestUser(string connectionId, string cookieId)
        {
            ConnectionId = connectionId;
            CookieId = cookieId;
            JoinedRoom = null;
            IsInTurn = false;
            TimeRemain = 0;
            Side = null;
            Enemy = null;
            RemainingFigures = new List<IFigure>();
        }

        public void SetTotalTime(int time)
        {
            this.TimeRemain = time;
        }
        public void ReduceTime()
        {
            this.TimeRemain--;
        }
        public int GetTimeRemain()
        {
            return this.TimeRemain;
        }
        public void SetConnectionId(string connectionId)
        {
            this.ConnectionId = connectionId;
        }
        public void SetJoinedRoom(Room joinedRoom)
        {
            this.JoinedRoom = joinedRoom;
        }
        public void SetIsInTurn(bool isTurn)
        {
            this.IsInTurn = isTurn;
        }
        public void SetSide(string side)
        {
            this.Side = side;
        }
        public void SetEnemy(GuestUser enemy)
        {
            this.Enemy = enemy;
        }
    }
    public class TurnInfo
    {
        public string TurnType { get; set; }
        public int PointA { get; set; }
        public int PointB { get; set; }
        public int TurnsCount { get; set; }
        public bool IsPotentiallyAttacked { get; set; }
        public int IsAttacked { get; set; }
        public char? FigureToExchange { get; set; }

        public List<int> AttackedZones { get; set; }

        public List<int> DefenceZones { get; set; }
    }
    public class Square
    {
        public IFigure Figure { get; set; }
        public bool IsAttacked { get; set; }
        public bool IsForDefend { get; set; }
        public void TakeOffFigure()
        {
            //this.Figure = null;         
            this.Figure = new EmptyPlaceFigure();
        }
        public void SetFigure(IFigure figure)
        {
            this.Figure = figure;
        }

        public Square()
        {
            //this.Figure = null;

            this.Figure = new EmptyPlaceFigure();
            this.IsAttacked = false;
            this.IsForDefend = false;
        }
        public Square(IFigure figure)
        {
            this.Figure = figure;
            this.IsAttacked = false;
            this.IsForDefend = false;
        }
    }

    public class Pawn : IFigure
    {
        public int EnPassant { get; set; }//turn when a pawn is available for the EnPassant
        public char Value { get; set; }
        public int Position { get; set; }
        public GameDetails Details { get; set; }
        public Square[] Board { get; set; }

        public bool ValidateTurn(TurnInfo turn)
        {
            var a = turn.PointA;
            var b = turn.PointB;

            if (this.Details.King.IsAttacked > 0)
            {
                if (this.Details.King.IsAttacked == 1)
                {
                    if (Board[a].IsForDefend == true) return false;
                }
                else if (this.Details.King.IsAttacked > 1)
                {
                    return false;
                }
            }
            else if (this.Details.King.IsPotentiallyAttacked == true)
            {
                if (Board[a].IsForDefend == true && Board[b].IsForDefend == false) return false;
            }

            this.Position = b;

            if (Board[b] != null && Board[b].Figure.Value == 'k') return false;

            if (Board[b].Figure.Value == ' ')//turn type == move
            {
                if (a < 58)
                {
                    if (b == a - 10)//one cell turn
                    {
                        if (b > 9)
                        {
                            Board[b].SetFigure(Board[a].Figure);
                        }
                        else//swap pawn when get topline
                        {
                            ExchangeFigure();
                        }
                        Board[a].TakeOffFigure();
                        return true;
                    }
                    if (b == a - 11)// en passant beat(left)
                    {
                        if (((Pawn)Board[a - 1].Figure).EnPassant == turn.TurnsCount - 1)
                        {
                            RemoveEnemyFigure(Board[a - 1].Figure);

                            Board[b].SetFigure(Board[a].Figure);
                            Board[a].TakeOffFigure();
                            Board[a - 1].TakeOffFigure();
                            return true;
                        }
                    }
                    if (b == a - 9)// en passant beat(right)
                    {
                        if (((Pawn)Board[a + 1].Figure).EnPassant == turn.TurnsCount - 1)
                        {
                            RemoveEnemyFigure(Board[a + 1].Figure);

                            Board[b].SetFigure(Board[a].Figure);
                            Board[a].TakeOffFigure();
                            Board[a + 1].TakeOffFigure();
                            return true;
                        }
                    }
                }
                else
                {
                    if (b == a - 10)//one cell turn
                    {
                        Board[b].SetFigure(Board[a].Figure);
                        Board[a].TakeOffFigure();
                        return true;
                    }
                    if (b == a - 20)//two cell turn
                    {
                        if (Board[a - 10].Figure.Value == ' ')
                        {
                            this.EnPassant = turn.TurnsCount;
                            Board[b].SetFigure(Board[a].Figure);
                            Board[a].TakeOffFigure();
                            return true;
                        }
                    }
                }
            }
            else //turn type == beat figure
            {
                if (b > 9)
                {
                    Board[b].SetFigure(Board[a].Figure);
                }
                else//exchange pawn when get topline
                {
                    ExchangeFigure();
                }
                if (b == a - 11)//figure beat(left)
                {
                    Board[a].TakeOffFigure();
                    return true;
                }
                if (b == a - 9)//figure beat(right)
                {
                    Board[a].TakeOffFigure();
                    return true;
                }

            }

            return false;

            void ExchangeFigure()
            {
                IFigure newFigure;

                switch (turn.FigureToExchange)
                {
                    case 'q':
                        newFigure = new Queen(b, this.Details);
                        newFigure.Value = 'q';
                        break;
                    case 'n':
                        newFigure = new Knight(b, this.Details);
                        newFigure.Value = 'n';
                        break;
                    case 'r':
                        newFigure = new Rook(b, this.Details);
                        newFigure.Value = 'r';
                        break;
                    case 'b':
                        newFigure = new Bishop(b, this.Details);
                        newFigure.Value = 'b';
                        break;
                    default:
                        newFigure = new Queen(b, this.Details);
                        newFigure.Value = 'q';
                        break;
                }

                newFigure.Board = this.Board;
                newFigure.Position = this.Position;
                Board[b].SetFigure(newFigure);

                AddFigure(newFigure);
                RemoveFigure(this);
            }
        }
        public void SetBeatZones()
        {
            var pos = this.Position;

            var zone1 = pos - 11;
            var zone2 = pos - 9;

            CheckZone(zone1);
            CheckZone(zone2);

            void CheckZone(int zone)
            {
                if (zone >= 0 && zone <= 77 && Board[zone] != null)
                {
                    if (Board[zone].Figure.Value == ' ')
                    {
                        Board[zone].IsAttacked = true;
                    }
                    else if (Board[zone].Figure.Value == 'k' && this.Details.Side != Board[zone].Figure.Details.Side)
                    {
                        Board[pos].IsForDefend = true;
                        this.Details.EnemyKing.IsAttacked++;
                    }
                }
            }
        }
        public int IsMovePossible(string moveType = "move")
        {
            int p = this.Position;
            int count = 0;

            Func<Square, bool> p1;

            if (moveType == "defence")
            {
                p1 = (Square s) => { return s.IsForDefend == true; };
            }
            else
            {
                p1 = (Square s) => { return true; };
            }

            count += CheckBeatZone(p - 11, p - 1, p1);
            count += CheckBeatZone(p - 9, p + 1, p1);
            count += CheckMoveZone(p - 10, p - 20, p1);

            return count;

            int CheckBeatZone(int zone1, int zone2, Func<Square, bool> condition)
            {
                if (zone1 >= 0 && zone1 <= 77 && Board[zone1] != null)
                {
                    if (Board[zone1].Figure.Value != ' '
                        && Board[zone1].Figure.Details.Side != this.Details.Side)
                    {
                        if (condition(Board[zone1]))
                        {
                            return 1;
                        }
                    }
                    else if (p > 29 && p < 38 && Board[zone2].Figure.Value != ' ')//en passan
                    {
                        if (condition(Board[zone2])
                            && Board[zone2].Figure.Value == 'p'
                            && ((Pawn)Board[zone2].Figure).EnPassant == this.GetTurnsCount() - 1)
                        {
                            return 1;
                        }
                    }
                }
                return 0;
            }
            int CheckMoveZone(int zone1, int zone2, Func<Square, bool> condition)
            {
                if (zone1 >= 0 && zone1 <= 77
                    && Board[zone1] != null
                    && Board[zone1].Figure.Value == ' ')
                {
                    if (condition(Board[zone1]))
                    {
                        return 1;
                    }
                    if (p > 59 && p < 68
                        && zone2 >= 0 && zone2 <= 77
                        && Board[zone2] != null
                        && Board[zone2].Figure.Value == ' '
                        && condition(Board[zone2]))
                    {
                        return 1;
                    }
                }
                return 0;
            }
        }
        private int GetTurnsCount()
        {
            return ChessHub.roomList[this.Details.RoomName].TurnsCount;
        }
        private void AddFigure(IFigure figure)
        {
            if (ChessHub.roomList[this.Details.RoomName].FirstPlayer.Side == this.Details.Side)
            {
                ChessHub.roomList[this.Details.RoomName].FirstPlayer.RemainingFigures.Add(figure);
            }
            else
            {
                ChessHub.roomList[this.Details.RoomName].SecondPlayer.RemainingFigures.Add(figure);
            }
        }
        void RemoveFigure(IFigure figure)
        {
            if (ChessHub.roomList[this.Details.RoomName].FirstPlayer.Side == this.Details.Side)
            {
                ChessHub.roomList[this.Details.RoomName].FirstPlayer.RemainingFigures.Remove(figure);
            }
            else
            {
                ChessHub.roomList[this.Details.RoomName].SecondPlayer.RemainingFigures.Remove(figure);
            }
        }
        void RemoveEnemyFigure(IFigure figure)
        {
            if (ChessHub.roomList[this.Details.RoomName].FirstPlayer.Side == this.Details.Side)
            {
                ChessHub.roomList[this.Details.RoomName].SecondPlayer.RemainingFigures.Remove(figure);
            }
            else
            {
                ChessHub.roomList[this.Details.RoomName].FirstPlayer.RemainingFigures.Remove(figure);
            }
        }
        public Pawn(int position)
        {
            this.EnPassant = 0;
            this.Value = 'p';
            this.Position = position;
            this.Details = null;
            this.Board = null;
        }
        public Pawn(int position, GameDetails details)
        {
            this.EnPassant = 0;
            this.Value = 'p';
            this.Position = position;
            this.Details = details;
            this.Board = null;
        }
    }
    public class Rook : IFigure
    {
        public char Value { get; set; }
        public int Position { get; set; }
        public bool IsFirstTurn { get; set; }
        public GameDetails Details { get; set; }
        public Square[] Board { get; set; }

        public virtual bool ValidateTurn(TurnInfo turn)
        {
            var a = turn.PointA;
            var b = turn.PointB;

            if (!IsNeedDefence(a, b)) return false;

            this.Position = b;

            int j;

            if ((a - b) % 10 == 0)//vertical turn
            {
                j = (a > b) ? -10 : 10;
            }
            else if ((a - b) % 1 == 0)//horizontal turn
            {
                j = (a > b) ? -1 : 1;
            }
            else
            {
                return false;
            }

            int B = b + j;
            int i = a + j;

            if (Board[b] != null && Board[b].Figure.Value == 'k') return false;

            for (; i != B; i += j)
            {
                if (Board[i].Figure.Value != ' ')
                {
                    if (Board[i].Figure.Details.Side != this.Details.Side)
                    {
                        i += j;
                        break;
                    }
                    else
                    {
                        return false;
                    }
                }
            }
            if (i == B)//beat figure
            {
                if (this.IsFirstTurn == true)
                {
                    this.IsFirstTurn = false;
                }
                Board[b].SetFigure(Board[a].Figure);
                Board[a].TakeOffFigure();
                return true;
            }

            return false;
        }
        public void SetBeatZones()
        {
            var pos = this.Position;

            int step = 0;
            int flag = 0;
            int i = 0;

            ChangeDirection(ref flag, ref step, ref i);
            

            for (i = step; ; i += step)
            {
                if ((pos + i) >= 0 && (pos + i) <= 77 && Board[pos + i] != null)
                {
                    if (Board[pos + i].Figure.Value == ' ')
                    {
                        Board[pos + i].IsAttacked = true;
                    }
                    else if (Board[pos + i].Figure.Value == 'k' && Board[pos + i].Figure.Details.Side != this.Details.Side)
                    {
                        this.Details.EnemyKing.IsAttacked++;

                        for (int j = pos + i - step; j != pos; j -= step)
                        {
                            Board[j].IsForDefend = true;
                        }
                        for (int j = pos + i + step; j >= 0 && j <= 77; j += step)
                        {
                            if (Board[j] != null && Board[j].Figure.Value == ' ')
                            {
                                Board[j].IsAttacked = true;
                            }
                            else
                            {
                                break;
                            }

                        }

                        Board[pos].IsForDefend = true;
                        if (!ChangeDirection(ref flag, ref step, ref i)) return;
                        //i = 0;
                    }
                    else
                    {
                        Board[pos + i].IsAttacked = true;

                        var k = pos + i + step;

                        while (k >= 0 && k <= 77 && Board[k] != null)
                        {
                            if (Board[k].Figure.Value != ' ')
                            {
                                if (Board[k].Figure.Value == 'k' && Board[k].Figure.Details.Side != this.Details.Side)
                                {
                                    this.Details.EnemyKing.IsPotentiallyAttacked = true;

                                    for (int j = k - step; j != (pos - step); j -= step)
                                    {
                                        Board[j].IsForDefend = true;
                                    }

                                    break;
                                }
                                else
                                {
                                    break;
                                }
                            }

                            k += step;
                        }
                        if (!ChangeDirection(ref flag, ref step, ref i)) return;
                        //i = 0;
                    }

                }
                else
                {
                    if (!ChangeDirection(ref flag, ref step, ref i)) return;
                    //i = 0;
                }
            }          
        }
        public virtual bool ChangeDirection(ref int flag, ref int step, ref int i)
        {
            switch (flag)
            {
                case 0:
                    step = -10;
                    break;
                case 1:
                    step = 10;
                    break;
                case 2:
                    step = -1;
                    break;
                case 3:
                    step = 1;
                    break;
                default:
                    return false;
            }
            i = 0;
            flag++;
            return true;
        }
        public virtual int IsMovePossible(string moveType = "move")
        {
            int p = this.Position;
            int count = 0;

            Func<Square, bool> p1;

            if (moveType == "defence")
            {
                p1 = (Square s) => { return s.IsForDefend == true; };
            }
            else
            {
                p1 = (Square s) => { return true; };
            }

            count += CheckKingDefenceZones(p, -10, p1);
            count += CheckKingDefenceZones(p, 1, p1);
            count += CheckKingDefenceZones(p, 10, p1);
            count += CheckKingDefenceZones(p, -1, p1);

            return count;
        }
        public int CheckKingDefenceZones(int id, int step, Func<Square, bool> condition)
        {
            int i;

            for (i = id += step; ; i += step)
            {
                if ((i) >= 0 && (i) <= 77 && Board[i] != null)
                {
                    if (Board[i].Figure.Value == ' ')
                    {
                        if (condition(Board[i]))
                        {
                            return 1;
                        }
                    }
                    else if (Board[i].Figure.Details.Side != this.Details.Side)
                    {
                        if (condition(Board[i]))
                        {
                            return 1;
                        }
                        break;
                    }
                    else
                    {
                        break;
                    }
                }
                else
                {
                    return 0;
                }
            }

            return 0;
        }
        public bool IsNeedDefence(int a, int b)
        {
            if (this.Details.King.IsAttacked > 0)
            {
                if (this.Details.King.IsAttacked == 1)
                {
                    if (Board[a].IsForDefend == true) return false;
                }
                else if (this.Details.King.IsAttacked > 1)
                {
                    return false;
                }
            }
            else if (this.Details.King.IsPotentiallyAttacked == true)
            {
                if (Board[a].IsForDefend == true && Board[b].IsForDefend == false) return false;
            }

            return true;
        }
        public Rook(int position)
        {
            this.Value = 'r';
            this.Position = position;
            this.IsFirstTurn = true;
            this.Details = null;
        }
        public Rook(int position, GameDetails details)
        {
            this.Value = 'r';
            this.Position = position;
            this.IsFirstTurn = true;
            this.Details = details;
        }
    }
    public class Knight : IFigure
    {
        readonly int[] Points = new int[8]
        {
            -19, -8, 12, 21, 19, 8, -12, -21
        };
        public char Value { get; set; }
        public int Position { get; set; }
        public GameDetails Details { get; set; }
        public Square[] Board { get; set; }

        public bool ValidateTurn(TurnInfo turn)
        {
            var a = turn.PointA;
            var b = turn.PointB;

            if (this.Details.King.IsAttacked > 0)
            {
                if (this.Details.King.IsAttacked == 1)
                {
                    if (Board[a].IsForDefend == true) return false;
                }
                else if (this.Details.King.IsAttacked > 1)
                {
                    return false;
                }
            }
            else if (this.Details.King.IsPotentiallyAttacked == true)
            {
                if (Board[a].IsForDefend == true && Board[b].IsForDefend == false) return false;
            }

            this.Position = b;

            if (Board[b] != null && Board[b].Figure.Value == 'k') return false;

            foreach (int point in Points)
            {
                if (b == a + point)
                {
                    if (Board[b].Figure.Value == ' ' || Board[b].Figure.Details.Side != this.Details.Side)
                    {
                        Board[b].SetFigure(Board[a].Figure);
                        Board[a].TakeOffFigure();
                        return true;
                    }
                    break;
                }
            }

            return false;
        }
        public void SetBeatZones()
        {
            var pos = this.Position;

            foreach (int point in Points)
            {
                if ((pos + point) >= 0 && (pos + point) <= 77 && Board[pos + point] != null)
                {
                    if (Board[pos + point].Figure.Value == ' ')
                    {
                        Board[pos + point].IsAttacked = true;
                    }
                    else if (Board[pos + point].Figure.Value == 'k' && this.Details.Side != Board[pos + point].Figure.Details.Side)
                    {
                        this.Details.EnemyKing.IsAttacked++;
                        Board[pos].IsForDefend = true;
                    }

                }
            }
        }
        public int IsMovePossible(string moveType = "move")
        {
            int p = this.Position;

            Func<Square, bool> p1;

            if (moveType == "defence")
            {
                p1 = (Square s) => { return s.IsForDefend == true; };
            }
            else
            {
                p1 = (Square s) => { return true; };
            }

            foreach (int point in Points)
            {
                if ((p + point) >= 0 && (p + point) <= 77 && Board[p + point] != null)
                {
                    if (Board[p + point].Figure.Value == ' ')
                    {
                        if (p1(Board[p + point]))
                        {
                            return 1;
                        }
                    }
                    else if (this.Details.Side != Board[p + point].Figure.Details.Side)
                    {
                        if (p1(Board[p + point]))
                        {
                            return 1;
                        }
                    }
                }
            }

            return 0;
        }

        public Knight(int position)
        {
            this.Value = 'n';
            this.Position = position;
            this.Details = null;
        }
        public Knight(int position, GameDetails details)
        {
            this.Value = 'n';
            this.Position = position;
            this.Details = details;
        }
    }
    public class Bishop : Rook
    {
        public override bool ValidateTurn(TurnInfo turn)
        {
            var a = turn.PointA;
            var b = turn.PointB;

            if (!IsNeedDefence(a, b)) return false;

            this.Position = b;

            int j;

            if ((a - b) % 11 == 0)//turn from right bottom to left top axis and back
            {
                j = (a > b) ? -11 : 11;
            }
            else if ((a - b) % 9 == 0)//turn from left bottom to right top axis and back
            {
                j = (a > b) ? -9 : 9;
            }
            else
            {
                return false;
            }

            int B = b + j;
            int i = a + j;

            if (Board[b] != null && Board[b].Figure.Value == 'k') return false;

            for (; i != B; i += j)
            {
                if (Board[i].Figure.Value != ' ')
                {
                    if (Board[i].Figure.Details.Side != this.Details.Side)
                    {
                        i += j;
                        break;
                    }
                    else
                    {
                        return false;
                    }
                }
            }
            if (i == B)//beat figure
            {
                Board[b].SetFigure(Board[a].Figure);
                Board[a].TakeOffFigure();
                return true;
            }

            return false;
        }      
        public override int IsMovePossible(string moveType = "move")
        {
            int p = this.Position;
            int count = 0;

            Func<Square, bool> p1;

            if (moveType == "defence")
            {
                p1 = (Square s) => { return s.IsForDefend == true; };
            }
            else
            {
                p1 = (Square s) => { return true; };
            }

            count += CheckKingDefenceZones(p, -9, p1);
            count += CheckKingDefenceZones(p, 11, p1);
            count += CheckKingDefenceZones(p, 9, p1);
            count += CheckKingDefenceZones(p, -11, p1);

            return count;
        }
        public override bool ChangeDirection(ref int flag, ref int step, ref int i)
        {
            switch (flag)
            {
                case 0:
                    step = -11;
                    break;
                case 1:
                    step = 11;
                    break;
                case 2:
                    step = -9;
                    break;
                case 3:
                    step = 9;
                    break;
                default:
                    return false;
            }
            i = 0;
            flag++;
            return true;
        }
        public Bishop(int position) : base(position)
        {
            this.Value = 'b';
            //this.Value = 'b';
            //this.Position = position;
            //this.Details = null;
        }
        public Bishop(int position, GameDetails details) : base(position, details)
        {
            this.Value = 'b';
            //this.Position = position;
            //this.Details = details;
        }
    }
    public class Queen : Rook
    {
        public override bool ValidateTurn(TurnInfo turn)
        {
            var a = turn.PointA;
            var b = turn.PointB;

            if (!IsNeedDefence(a, b)) return false;

            this.Position = b;

            int j;

            if ((a - b) % 11 == 0)//turn from right bottom to left top axis and back
            {
                j = (a > b) ? -11 : 11;
            }
            else if ((a - b) % 9 == 0)//turn from left bottom to right top axis and back
            {
                j = (a > b) ? -9 : 9;
            }
            else if ((a - b) % 10 == 0)//vertical turn
            {
                j = (a > b) ? -10 : 10;
            }
            else if ((a - b) % 1 == 0)//horizontal turn
            {
                j = (a > b) ? -1 : 1;
            }
            else
            {
                return false;
            }

            int B = b + j;
            int i = a + j;

            if (Board[b] != null && Board[b].Figure.Value == 'k') return false;

            for (; i != B; i += j)
            {
                if (Board[i].Figure.Value != ' ')
                {
                    if (Board[i].Figure.Details.Side != this.Details.Side)
                    {
                        i += j;
                        break;
                    }
                    else
                    {
                        return false;
                    }
                }
            }
            if (i == B)//beat figure
            {
                Board[b].SetFigure(Board[a].Figure);
                Board[a].TakeOffFigure();
                return true;
            }

            return false;
        }
        public override bool ChangeDirection(ref int flag, ref int step, ref int i)
        {
            switch (flag)
            {
                case 0:
                    step = -11;
                    break;
                case 1:
                    step = -10;
                    break;
                case 2:
                    step = -9;
                    break;
                case 3:
                    step = 1;
                    break;
                case 4:
                    step = 11;
                    break;
                case 5:
                    step = 10;
                    break;
                case 6:
                    step = 9;
                    break;
                case 7:
                    step = -1;
                    break;
                default:
                    return false;
            }
            i = 0;
            flag++;
            return true;
        }
     
        public override int IsMovePossible(string moveType = "move")
        {
            int p = this.Position;
            int count = 0;

            Func<Square, bool> p1;

            if (moveType == "defence")
            {
                p1 = (Square s) => { return s.IsForDefend == true; };
            }
            else
            {
                p1 = (Square s) => { return true; };
            }

            count += CheckKingDefenceZones(p, -10, p1);
            count += CheckKingDefenceZones(p, -9, p1);
            count += CheckKingDefenceZones(p, 1, p1);
            count += CheckKingDefenceZones(p, 11, p1);
            count += CheckKingDefenceZones(p, 10, p1);
            count += CheckKingDefenceZones(p, 9, p1);
            count += CheckKingDefenceZones(p, -1, p1);
            count += CheckKingDefenceZones(p, -11, p1);

            return count;
        }

        public Queen(int position) : base(position)
        {
            this.Value = 'q';
            //this.Position = position;
        }
        public Queen(int position, GameDetails details) : base(position, details)
        {
            this.Value = 'q';
            //this.Position = position;
            //this.Details = details;
        }
    }
    public class King : IFigure
    {
        readonly int[] Points = new int[8]
        {
            -11, -10, -9, 1, 11, 10, 9, -1
        };
        public char Value { get; set; }
        public int Position { get; set; }
        public bool IsFirstTurn { get; set; }
        public int IsAttacked { get; set; }
        public bool IsPotentiallyAttacked { get; set; }
        public GameDetails Details { get; set; }
        public Square[] Board { get; set; }

        public bool ValidateTurn(TurnInfo turn)
        {
            var a = turn.PointA;
            var b = turn.PointB;

            if (Board[b] != null && Board[b].Figure.Value == 'k') return false;

            foreach (int point in Points)
            {
                if (b == a + point)
                {
                    if (Board[b].IsAttacked == false && (Board[b].Figure.Value == ' ' || Board[b].Figure.Details.Side != this.Details.Side))
                    {
                        if (this.IsFirstTurn == true)
                        {
                            this.IsFirstTurn = false;
                        }
                        Board[b].SetFigure(Board[a].Figure);
                        Board[a].TakeOffFigure();
                        this.Position = b;

                        return true;
                    }
                    break;
                }
            }
            if (Board[b].Figure.Value == 'r' && Board[b].Figure.Details.Side == this.Details.Side)
            {
                if (this.IsFirstTurn == true
                    && ((Rook)Board[b].Figure).IsFirstTurn == true
                    && this.IsAttacked == 0)
                {
                    int p1, p2, p3;

                    if (b == 70)
                    {
                        p1 = a - 1; p2 = a - 2; p3 = a - 3;
                    }
                    else
                    {
                        p1 = a + 1; p2 = a + 2; p3 = a + 3;
                    }

                    if (Board[p1].Figure.Value == ' '
                        && Board[p2].Figure.Value == ' '
                        && Board[p1].IsAttacked == false
                        && Board[p2].IsAttacked == false
                        && (p3 == b || Board[p3].Figure.Value == ' '))
                    {
                        ((Rook)Board[b].Figure).IsFirstTurn = false;
                        Board[b].Figure.Position = p1;
                        Board[p1].SetFigure(Board[b].Figure);
                        Board[b].TakeOffFigure();

                        this.IsFirstTurn = false;
                        this.Position = p2;
                        Board[p2].SetFigure(Board[a].Figure);
                        Board[a].TakeOffFigure();

                        return true;
                    }
                }
            }

            return false;
        }
        public void SetBeatZones()
        {
            var pos = this.Position;

            foreach (int point in Points)
            {
                if ((pos + point) >= 0 && (pos + point) <= 77 && Board[pos + point] != null)
                {
                    Board[pos + point].IsAttacked = true;
                }
            }
        }
        public int IsMovePossible(string moveType = "move")
        {
            var p = this.Position;

            foreach (int point in Points)
            {
                if ((p + point) >= 0 && (p + point) <= 77
                    && Board[p + point] != null
                    && Board[p + point].IsAttacked == false)
                {
                    if (Board[p + point].Figure.Value == ' '
                        || Board[p + point].Figure.Details.Side != this.Details.Side)
                    {
                        return 1;
                    }
                }
            }

            return 0;
        }

        public King(int position)
        {
            this.Value = 'k';
            this.Position = position;
            this.IsFirstTurn = true;
            this.IsAttacked = 0;
            this.IsPotentiallyAttacked = false;
            this.Details = null;
        }
        public King(int position, GameDetails details)
        {
            this.Value = 'k';
            this.Position = position;
            this.IsFirstTurn = true;
            this.IsAttacked = 0;
            this.IsPotentiallyAttacked = false;
            this.Details = details;
        }
    }

    public class EmptyPlaceFigure : IFigure
    {
        public char Value { get; set; }
        public int Position { get; set; }
        public GameDetails Details { get; set; }
        public Square[] Board { get; set; }

        public void SetBeatZones()
        {
            throw new NotImplementedException();
        }

        public bool ValidateTurn(TurnInfo turnInfo)
        {
            throw new NotImplementedException();
        }

        public int IsMovePossible(string moveType = "move")
        {
            throw new NotImplementedException();
        }

        public EmptyPlaceFigure()
        {
            this.Value = ' ';
            this.Position = 0;
            this.Details = null;
            this.Board = null;
        }
    }
    public interface IFigure
    {
        char Value { get; set; }
        int Position { get; set; }
        GameDetails Details { get; set; }
        Square[] Board { get; set; }
        bool ValidateTurn(TurnInfo turnInfo);
        void SetBeatZones();
        int IsMovePossible(string moveType = "move");
    }
    public class GameDetails
    {
        public King King { get; set; }
        public King EnemyKing { get; set; }
        public string Side { get; set; }
        public string EnemySide { get; set; }
        public string RoomName { get; set; }
    }
    public class CloseSessionRequest
    {
        public string RoomName { get; set; }
        public string Cause { get; set; }
        public string WinnerId { get; set; }
    }
        
}
