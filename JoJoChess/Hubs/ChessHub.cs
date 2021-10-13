using System;
using System.Collections.Generic;
using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;
using System.Threading;

namespace JoJoChess.Hubs
{
    public class ChessHub : Hub
    {
        #region Hub variables
        public static Dictionary<string, GuestUser> GuestList = new Dictionary<string, GuestUser>();
        public static Dictionary<string, Room> RoomList = new Dictionary<string, Room>();
        public static List<string> ConnectionList = new List<string>();
        public static Dictionary<string, string> AvailableRoomList = new Dictionary<string, string>();
        public static Dictionary<string, Timer> TimerList = new Dictionary<string, Timer>();
       
        IHubContext<ChessHub> _hubContext = null;
        #endregion
        public ChessHub(IHubContext<ChessHub> hubContext)
        {
            _hubContext = hubContext;
        }

        #region Connection managment
        public override async Task OnConnectedAsync()
        {
            var currConnectionId = Context.ConnectionId;
            var context = Context.GetHttpContext();

            ConnectionList.Add(currConnectionId);

            string currCookieId;

            if (context.Request.Cookies.TryGetValue("name", out currCookieId))
            {
                GuestUser currentUser;

                if (!GuestList.TryGetValue(currCookieId, out currentUser))
                {
                    var newUser = new GuestUser(currConnectionId, currCookieId);

                    GuestList.Add(currCookieId, newUser);

                    await Clients.Caller.SendAsync("ReceiveAvailableRooms", AvailableRoomList);
                }
                else if (currentUser.JoinedRoom != null)
                {
                    currentUser.SetConnectionId(currConnectionId);
                    await ReconnectToRoom(currentUser);
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
                //toCallerMessage = "game does not works without cookies!";
                //toOthersMessage = "enemy without cookies";               
            }

            //await Clients.Caller.SendAsync("ReceiveInfoMessage", toCallerMessage);
            //await Clients.Others.SendAsync("ReceiveInfoMessage", toOthersMessage);         

            await base.OnConnectedAsync();
        }
        public override async Task OnDisconnectedAsync(Exception exception)
        {
            ConnectionList.Remove(Context.ConnectionId);

            var context = Context.GetHttpContext();

            string currCookieId;

            if (context.Request.Cookies.TryGetValue("name", out currCookieId))
            {
                GuestUser currentUser;

                if (GuestList.TryGetValue(currCookieId, out currentUser))
                {
                    //rooms are named as their ovners guest name(guest name - CookieId)
                    if (currentUser.JoinedRoom == null)
                    {
                        GuestList.Remove(currCookieId);

                        if (RoomList.ContainsKey(currCookieId))
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
    
            await base.OnDisconnectedAsync(exception);
        }
        public async Task ReconnectToRoom(GuestUser guestUser)
        {
            await Groups.AddToGroupAsync(guestUser.ConnectionId, guestUser.JoinedRoom.Name);

            var reconnectSettings = new
            {
                rooms = AvailableRoomList,
                joinedRoom = guestUser.JoinedRoom.Name,
                isInTurn = guestUser.IsInTurn,
                time = guestUser.TimeRemain,
                side = guestUser.Side,
                lastTurnInfo = guestUser.JoinedRoom.LastTurnInfo,
                piecesCounter = guestUser.RemainingPieces[0].Details.PiecesCounter
            };

            await Clients.Caller.SendAsync("ReceiveReconnect", reconnectSettings);
        }
        #endregion

        #region Room managment
        public async Task CreateRoom(string roomName, string settingsIndex)
        {
            GuestUser firstPlayer;

            if (GuestList.TryGetValue(roomName, out firstPlayer))
            {
                var newRoom = new Room(roomName, firstPlayer, settingsIndex);

                RoomList.Add(roomName, newRoom);
                AvailableRoomList.Add(roomName, settingsIndex);

                await Clients.Others.SendAsync("ReceiveCreatedRoom", roomName, settingsIndex);

                await Groups.AddToGroupAsync(Context.ConnectionId, roomName);
            }
        }      
        public async Task DeleteRoom(string roomName)
        {
            Room roomToDelete;

            if (RoomList.TryGetValue(roomName, out roomToDelete))
            {
                if (roomToDelete.FirstPlayer != null)
                {
                    await Groups.RemoveFromGroupAsync(roomToDelete.FirstPlayer.ConnectionId, roomName);
                }
                if (roomToDelete.SecondPlayer == null)
                {
                    AvailableRoomList.Remove(roomName);
                }
                else//if second player is not in the room, room is available
                {
                    await Groups.RemoveFromGroupAsync(roomToDelete.SecondPlayer.ConnectionId, roomName);
                }

                RoomList.Remove(roomName);

                await Clients.All.SendAsync("ReceiveDeletedRoom", roomName);
            }
        }
        public async Task JoinToRoom(string user, string roomName)
        {
            if (AvailableRoomList.ContainsKey(roomName))
            {
                AvailableRoomList.Remove(roomName);

                Room oldEmptyRoom;

                if (RoomList.TryGetValue(roomName, out oldEmptyRoom))
                {
                    GuestUser secondPlayer;

                    if (GuestList.TryGetValue(user, out secondPlayer))
                    {
                        oldEmptyRoom.SetSecondPlayer(secondPlayer);

                        await Groups.AddToGroupAsync(Context.ConnectionId, roomName);
                       
                        await Clients.All.SendAsync("ReceiveDeletedRoom", roomName);
                        await Clients.Group(roomName).SendAsync("ReceiveJoinedRoom", roomName, oldEmptyRoom.SettingsIndex);

                        //game session start
                        await StartSession(roomName);
                    }
                }
            }
        }
        #endregion

        #region Session managment
        public async Task StartSession(string roomName)
        {
            var currentRoom = RoomList[roomName];

            var fp = currentRoom.FirstPlayer;
            var sp = currentRoom.SecondPlayer;

            fp.SetEnemy(sp);
            sp.SetEnemy(fp);

            fp.SetJoinedRoom(currentRoom);
            sp.SetJoinedRoom(currentRoom);

            fp.SetSide("white");
            sp.SetSide("black");


            if (currentRoom.SettingsIndex == "0")//BLITZ
            {
                fp.SetTotalTime(300);
                sp.SetTotalTime(300);
            }
            else if (currentRoom.SettingsIndex == "1")//RAPID
            {
                fp.SetTotalTime(900);
                sp.SetTotalTime(900);
            }
            else
            {
                fp.SetTotalTime(12600);
                sp.SetTotalTime(12600);
            }

            fp.SetIsInTurn(true);
            sp.SetIsInTurn(false);

            var board = currentRoom.Board;

            for (int pieceId = 0; pieceId < 18; pieceId++)
            {
                if (pieceId == 8)
                {
                    pieceId = 10;
                }
                sp.RemainingPieces.Add(board[pieceId].Piece);
            }
            for (int pieceId = 60; pieceId < 78; pieceId++)
            {
                if (pieceId == 68)
                {
                    pieceId = 70;
                }
                fp.RemainingPieces.Add(board[pieceId].Piece);
            }

            await Clients.Client(fp.ConnectionId).SendAsync("ReceiveStartGameSession", "Your turn!", true);
            await Clients.Client(sp.ConnectionId).SendAsync("ReceiveStartGameSession", "Enemy turn!", false);

            Timer sessionTimer = null;
           
            sessionTimer = new Timer(new TimerCallback(async y =>
            {
                if (fp.TimeRemain != 1 && sp.TimeRemain != 1)
                {
                    if (fp.IsInTurn)
                    {
                        fp.ReduceTime();
                    }
                    else
                    {
                        sp.ReduceTime();
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
                }

            }), null, 0, 1000);

            TimerList.Add(roomName, sessionTimer);
        }   
        public async Task CloseGameSession(CloseSessionRequest req)
        {
            Room roomToClose;

            if (RoomList.TryGetValue(req.RoomName, out roomToClose))
            {
                TimerList[roomToClose.Name].Dispose();
                TimerList.Remove(roomToClose.Name);
                
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
                        message1 = "Win on time.";
                        message2 = "Lose on time.";
                        break;

                    case "d":
                        message1 = "Draw.";
                        message2 = "Draw.";
                        winnerCause = "d";
                        loserCause = "d";
                        break;

                    case "w":
                        message1 = "Checkmate.";
                        message2 = "Checkmate.";
                        break;

                    case "g":
                        message1 = "Enemy gave up.";
                        message2 = "You gave up.";
                        break;

                    case "p":
                        message1 = "Draw, stalemate.";
                        message2 = "Draw, stalemate.";
                        winnerCause = "d";
                        loserCause = "d";
                        break;
                }

                await _hubContext.Clients.Client(req.WinnerId).SendAsync("ReceiveCloseGameSession", message1, winnerCause);
                await _hubContext.Clients.GroupExcept(roomToClose.Name, req.WinnerId).SendAsync("ReceiveCloseGameSession", message2, loserCause);

                RoomList.Remove(roomToClose.Name);

                firstPlayer.SetJoinedRoom(null);
                secondPlayer.SetJoinedRoom(null);

                firstPlayer.SetIsInTurn(false);
                secondPlayer.SetIsInTurn(false);

                firstPlayer.Enemy = null;
                secondPlayer.Enemy = null;

                firstPlayer.RemainingPieces.Clear();
                secondPlayer.RemainingPieces.Clear();

                firstPlayer.TimeRemain = 0;
                secondPlayer.TimeRemain = 0;

                await _hubContext.Groups.RemoveFromGroupAsync(firstPlayer.ConnectionId, req.RoomName);
                await _hubContext.Groups.RemoveFromGroupAsync(secondPlayer.ConnectionId, req.RoomName);

                //after timer is end
                if (!ConnectionList.Contains(firstPlayer.ConnectionId))//if player not online when game is end
                {
                    GuestList.Remove(firstPlayer.CookieId);
                }
                if (!ConnectionList.Contains(secondPlayer.ConnectionId))
                {
                    GuestList.Remove(secondPlayer.CookieId);
                }
            }
        }
        public async Task DrawOffer(string playerName)
        {
            var player = GuestList[playerName];

            if (player != null && player.ConnectionId == Context.ConnectionId)//validate user
            {
                await Clients.OthersInGroup(player.JoinedRoom.Name).SendAsync("ReceiveDrawOffer");
            }
        }
        public async Task MakeTurn(string playerName, TurnInfo turnInfo)
        {
            var player = GuestList[playerName];

            Room room = player.JoinedRoom;

            if (player != null && player.ConnectionId == Context.ConnectionId && player.IsInTurn == true)//validate user
            {
                var board = room.Board;

                bool isTurnCorrect = false;
                bool checkmate = false;
                bool stalemate = false;
                bool check = false;

                room.TurnsCount++;
                turnInfo.TurnsCount = room.TurnsCount;

                try
                {
                    if (player.Side == board[turnInfo.PointA].Piece.Details.Side)
                    {
                        if (board[turnInfo.PointB].Piece.Value != ' ')
                        {
                            player.Enemy.RemainingPieces.Remove(board[turnInfo.PointB].Piece);
                        }

                        var pieceToMove = board[turnInfo.PointA].Piece;                      
                        var enemyKing = pieceToMove.Details.EnemyKing;
                        isTurnCorrect = pieceToMove.ValidateTurn(turnInfo);

                        for (int i = 0; i < 78; i++)
                        {
                            if (board[i] != null)
                            {
                                if (board[i].IsAttacked != false) board[i].IsAttacked = false;
                                if (board[i].UnderAttack != null) board[i].UnderAttack = null;
                                if (board[i].IsForDefend != false) board[i].IsForDefend = false;
                            }
                        }//clearing board beat zones

                        enemyKing.IsAttacked = 0;
                        enemyKing.UnderAttack = null;                      
                        enemyKing.IsPotentiallyAttacked = false;

                        foreach (IPiece figure in player.RemainingPieces)
                        {
                            figure.SetBeatZones();
                        }//setting new beat zones

                        turnInfo.IsAttacked = enemyKing.IsAttacked;
                        turnInfo.IsPotentiallyAttacked = enemyKing.IsPotentiallyAttacked;
                        turnInfo.UnderAttack = enemyKing.UnderAttack;

                        for (int i = 0; i < 78; i++)
                        {
                            if (board[i] != null)
                            {
                                if (board[i].IsAttacked == true)
                                {
                                    turnInfo.AttackedZones.Add(i);
                                }
                                if (board[i].IsForDefend == true)
                                {                                       
                                    turnInfo.DefenceZones.Add(new TurnInfo.DefenceCell(i, board[i].UnderAttack));
                                }

                            }
                        }//beat zones array for client

                        Array.Reverse(board);

                        int availableMovesAmount = 0;

                        foreach (IPiece figure in player.Enemy.RemainingPieces)
                        {
                            if (enemyKing.IsAttacked > 0)
                            {
                                if (board[figure.Position].IsForDefend == false && enemyKing.IsAttacked < 2)
                                {
                                    availableMovesAmount += figure.IsMovePossible(KingState.StartDefence);
                                }
                                else if (enemyKing.IsAttacked > 1)
                                {
                                    availableMovesAmount += enemyKing.IsMovePossible();
                                }
                            }
                            else if (enemyKing.IsPotentiallyAttacked == true && board[figure.Position].IsForDefend == true)
                            {
                                availableMovesAmount += figure.IsMovePossible(KingState.ContinueDefence);
                            }
                            else
                            {
                                availableMovesAmount += figure.IsMovePossible(KingState.FreeMove);
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
                    Console.WriteLine(ex.Message);
                }

                if (isTurnCorrect == true)
                {
                    room.LastTurnInfo = turnInfo;
                    await Clients.OthersInGroup(room.Name).SendAsync("ReceivePieceMove", turnInfo);
                    await SwitchWhoseTurn(room.Name);

                    if (checkmate == true)
                    {
                        await Clients.Group(room.Name).SendAsync("ReceiveSpecialTurn", 1);
                        await CloseGameSession(new CloseSessionRequest { RoomName = room.Name, Cause = "w", WinnerId = player.ConnectionId });
                    }
                    else if (stalemate == true)
                    {
                        await Clients.Group(room.Name).SendAsync("ReceiveSpecialTurn", 2);
                        await CloseGameSession(new CloseSessionRequest { RoomName = room.Name, Cause = "p", WinnerId = null });                        
                    }
                    else if (check == true)
                    {
                        await Clients.Group(room.Name).SendAsync("ReceiveSpecialTurn", 3);
                    }               
                }
                else
                {
                    Console.WriteLine("   --------------");
                    Console.WriteLine("   | TURN ERROR |");
                    Console.WriteLine("   --------------");//turn error console message
                    await Clients.Group(room.Name).SendAsync("ReceiveInfoMessage", "TURN ERROR");
                }
            }
            else
            {
                Console.WriteLine("   --------------");
                Console.WriteLine("   | USER ERROR |");
                Console.WriteLine("   --------------");//user error console message
                await Clients.Group(room.Name).SendAsync("ReceiveInfoMessage", "USER ERROR");
            }
        }
        public async Task SwitchWhoseTurn(string roomName)
        {
            Room room;

            if (RoomList.TryGetValue(roomName, out room))
            {
                if (room.FirstPlayer.IsInTurn)
                {
                    room.FirstPlayer.SetIsInTurn(false);
                    room.SecondPlayer.SetIsInTurn(true);

                    await Clients.Client(room.FirstPlayer.ConnectionId).SendAsync("ReceiveTurn", "Enemy turn!", false);
                    await Clients.Client(room.SecondPlayer.ConnectionId).SendAsync("ReceiveTurn", "Your turn!", true);
                }
                else
                {
                    room.FirstPlayer.SetIsInTurn(true);
                    room.SecondPlayer.SetIsInTurn(false);

                    await Clients.Client(room.FirstPlayer.ConnectionId).SendAsync("ReceiveTurn", "Your turn!", true);
                    await Clients.Client(room.SecondPlayer.ConnectionId).SendAsync("ReceiveTurn", "Enemy turn!", false);
                }
            }
        }//set who has a turn now
        #endregion
    }


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
            var d1 = new GameDetails
            {
                Side = "black",
                EnemySide = "white",
                King = null,
                EnemyKing = null,
                RoomName = roomName,
                PiecesCounter = 0
            };
            var d2 = new GameDetails
            {
                Side = "white",
                EnemySide = "black",
                King = null,//k2,
                EnemyKing = null,//k1,
                RoomName = roomName,
                PiecesCounter = 0
            }; 

            Name = roomName;
            FirstPlayer = firstPlayer;
            SecondPlayer = null;
            SettingsIndex = settingsIndex;
            TurnsCount = 0;
            Board = new Square[78]
            {
                      new Square(new Rook(77, d1)), new Square(new Knight(76, d1)), new Square(new Bishop(75, d1)), new Square(new Queen(74, d1)), new Square(new King(73, d1)), new Square(new Bishop(72, d1)), new Square(new Knight(71, d1)), new Square(new Rook(70, d1)), null,
                null, new Square(new Pawn(67, d1)), new Square(new Pawn(66, d1)), new Square(new Pawn(65, d1)), new Square(new Pawn(64, d1)), new Square(new Pawn(63, d1)), new Square(new Pawn(62, d1)), new Square(new Pawn(61, d1)), new Square(new Pawn(60, d1)), null,
                null, new Square(), new Square(), new Square(), new Square(), new Square(), new Square(), new Square(), new Square(), null,
                null, new Square(), new Square(), new Square(), new Square(), new Square(), new Square(), new Square(), new Square(), null,
                null, new Square(), new Square(), new Square(), new Square(), new Square(), new Square(), new Square(), new Square(), null,
                null, new Square(), new Square(), new Square(), new Square(), new Square(), new Square(), new Square(), new Square(), null,
                null, new Square(new Pawn(60, d2)), new Square(new Pawn(61, d2)), new Square(new Pawn(62, d2)), new Square(new Pawn(63, d2)), new Square(new Pawn(64, d2)), new Square(new Pawn(65, d2)), new Square(new Pawn(66, d2)), new Square(new Pawn(67, d2)), null,
                null, new Square(new Rook(70, d2)), new Square(new Knight(71, d2)), new Square(new Bishop(72, d2)), new Square(new Queen(73, d2)), new Square(new King(74, d2)), new Square(new Bishop(75, d2)), new Square(new Knight(76, d2)), new Square(new Rook(77, d2))
            };

            d1.King = (King)Board[4].Piece;
            d1.EnemyKing = (King)Board[74].Piece;

            d2.King = d1.EnemyKing;
            d2.EnemyKing = d1.King;

            LastTurnInfo = null;

            for (int i = 0; i < 8; i++)
            {
                Board[i].Piece.Board = Board;
            }
            for (int i = 10; i < 18; i++)
            {
                Board[i].Piece.Board = Board;
            }
            for (int i = 60; i < 68; i++)
            {
                Board[i].Piece.Board = Board;
            }
            for (int i = 70; i < 78; i++)
            {
                Board[i].Piece.Board = Board;
            }
        }

        public void SetFirstPlayer(GuestUser fp)
        {
            FirstPlayer = fp;
        }
        public void SetSecondPlayer(GuestUser sp)
        {
            SecondPlayer = sp;
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
        public List<IPiece> RemainingPieces { get; set; }

        public GuestUser(string connectionId, string cookieId)
        {
            ConnectionId = connectionId;
            CookieId = cookieId;
            JoinedRoom = null;
            IsInTurn = false;
            TimeRemain = 0;
            Side = null;
            Enemy = null;
            RemainingPieces = new List<IPiece>();
        }

        public void SetTotalTime(int time)
        {
            TimeRemain = time;
        }
        public void ReduceTime()
        {
            TimeRemain--;
        }
        public int GetTimeRemain()
        {
            return TimeRemain;
        }
        public void SetConnectionId(string connectionId)
        {
            ConnectionId = connectionId;
        }
        public void SetJoinedRoom(Room joinedRoom)
        {
            JoinedRoom = joinedRoom;
        }
        public void SetIsInTurn(bool isTurn)
        {
            IsInTurn = isTurn;
        }
        public void SetSide(string side)
        {
            Side = side;
        }
        public void SetEnemy(GuestUser enemy)
        {
            Enemy = enemy;
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
        public string UnderAttack { get; set; }
        public char? PieceToExchange { get; set; }

        public List<int> AttackedZones { get; set; }

        public List<DefenceCell> DefenceZones { get; set; }
        public class DefenceCell 
        { 
            public int Id { get; set; }
            public string UnderAttack { get; set; }

            public DefenceCell(int id)
            {
                Id = id;
                UnderAttack = null;
            }
            public DefenceCell(int id, string underAttack)
            {
                Id = id;
                UnderAttack = underAttack;
            }
        }

    }
    public class Square
    {
        public IPiece Piece { get; set; }
        public bool IsAttacked { get; set; }
        public string UnderAttack { get; set; }
        public string UnderDefence { get; set; }
        public bool IsForDefend { get; set; }
        public void TakeOffPiece()
        {       
            Piece = new EmptyPlacePiece();
        }
        public void SetPiece(IPiece figure)
        {
            Piece = figure;
        }

        public Square()
        {
            Piece = new EmptyPlacePiece();
            IsAttacked = false;
            IsForDefend = false;
            UnderAttack = null;
        }
        public Square(IPiece piece)
        {
            Piece = piece;
            IsAttacked = false;
            IsForDefend = false;
            UnderAttack = null;
        }
    }

    public class Pawn : IPiece
    {
        private int EnPassant { get; set; }//turn when a pawn is available for the EnPassant
        public char Value { get; }
        public string Id { get; set; }
        public int Position { get; set; }
        public GameDetails Details { get; set; }
        public Square[] Board { get; set; }
        
        public bool ValidateTurn(TurnInfo turn)
        {
            var a = turn.PointA;
            var b = turn.PointB;

            Action AcceptTurn = () => { } ;
     
            var king = this.Details.King;  
            
            bool isEnPassant = false;
         
            if (Board[b].Piece.Value != 'k' && king.IsAttacked < 2)
            {
                this.Position = b;
               
                if (IsMoveCorrect() && IsKingUnderDefence()) 
                {                  
                    AcceptTurn();
                    return true;
                }
            }

            return false;

            void ExchangePiece()
            {
                IPiece newPiece;

                switch (turn.PieceToExchange)
                {
                    case 'q':
                        newPiece = new Queen(b, this.Details);                    
                        break;
                    case 'n':
                        newPiece = new Knight(b, this.Details);
                        break;
                    case 'r':
                        newPiece = new Rook(b, this.Details);
                        break;
                    case 'b':
                        newPiece = new Bishop(b, this.Details);
                        break;
                    default:
                        newPiece = new Queen(b, this.Details);
                        break;
                }

                newPiece.Board = this.Board;

                Board[b].SetPiece(newPiece);

                AddPiece(newPiece);
                RemovePiece(this);
            }

            bool IsKingUnderDefence()
            {
                if (king.IsAttacked > 0) //when king.isAttacked == 1
                {
                    if (Board[a].IsForDefend == true) return false;
                    if (Board[b].IsForDefend == true)
                    {
                        if (Board[b].Piece.Value == ' ')
                        {
                            if (Board[b].UnderAttack != king.UnderAttack) return false;
                        }
                        else
                        {
                            if (Board[b].Piece.Id != king.UnderAttack) return false;
                        }
                    }
                    else if (isEnPassant == false) { return false; }
                }
                else if (king.IsPotentiallyAttacked == true)
                {
                    if (Board[a].IsForDefend == true)
                    {
                        if (Board[b].IsForDefend == false) return false;
                        else
                        {
                            if (Board[b].Piece.Value == ' ')
                            {
                                if (Board[a].UnderAttack != Board[b].UnderAttack) return false;
                            }
                            else
                            {
                                if (Board[a].UnderAttack != Board[b].Piece.Id) return false;
                            }
                        }
                    }
                }

                return true;
            }
            bool IsMoveCorrect()
            {
                if (Board[b].Piece.Value == ' ')   //turn type == move
                {
                    if (a < 58)
                    {
                        if (b == a - 10)//one cell turn
                        {
                            if (b > 9)
                            {
                                AcceptTurn = () =>
                                {
                                    Board[b].SetPiece(this);
                                    Board[a].TakeOffPiece();
                                };
                            }
                            else//swap pawn when get topline
                            {
                                AcceptTurn = () =>
                                {
                                    ExchangePiece();
                                    Board[a].TakeOffPiece();
                                };
                            }
                            
                            return true;
                        }
                        else if (b == a - 11)// en passant beat(left)
                        {
                            if (((Pawn)Board[a - 1].Piece).EnPassant == turn.TurnsCount - 1)
                            {
                                AcceptTurn = () =>
                                {
                                    RemoveEnemyPiece(Board[a - 1].Piece);
                                    Board[b].SetPiece(this);
                                    Board[a].TakeOffPiece();
                                    Board[a - 1].TakeOffPiece();
                                };
                                isEnPassant = true;
                                return true;
                            }
                        }
                        else if (b == a - 9)// en passant beat(right)
                        {
                            if (((Pawn)Board[a + 1].Piece).EnPassant == turn.TurnsCount - 1)
                            {
                                AcceptTurn = () =>
                                {
                                    RemoveEnemyPiece(Board[a + 1].Piece);
                                    Board[b].SetPiece(this);
                                    Board[a].TakeOffPiece();
                                    Board[a + 1].TakeOffPiece();

                                };
                                isEnPassant = true;
                                return true;
                            }
                        }
                    }
                    else
                    {
                        if (b == a - 10)//one cell turn
                        {
                            AcceptTurn = () =>
                            {
                                Board[b].SetPiece(this);
                                Board[a].TakeOffPiece();
                            };
                            return true;
                        }
                        else if (b == a - 20)//two cell turn
                        {
                            if (Board[a - 10].Piece.Value == ' ')
                            {
                                this.EnPassant = turn.TurnsCount;
                                AcceptTurn = () =>
                                {
                                    Board[b].SetPiece(this);
                                    Board[a].TakeOffPiece();
                                };
                                return true;
                            }
                        }
                    }
                }//turn type == move
                else    //turn type == beat figure
                {                    
                    if (b == a - 11 || b == a - 9)//figure beat(left)
                    {
                        if (b > 9)
                        {
                            AcceptTurn = () =>
                            {
                                Board[b].SetPiece(this);
                                Board[a].TakeOffPiece();
                            };
                        }
                        else//exchange pawn when get topline
                        {
                            AcceptTurn = () =>
                            {
                                ExchangePiece();
                                Board[a].TakeOffPiece();
                            };
                        }
                        
                        return true;
                    }
                }//turn type == beat figure

                return false;
            }
            
            void AddPiece(IPiece piece)
            {
                if (ChessHub.RoomList[this.Details.RoomName].FirstPlayer.Side == this.Details.Side)
                {
                    ChessHub.RoomList[this.Details.RoomName].FirstPlayer.RemainingPieces.Add(piece);
                }
                else
                {
                    ChessHub.RoomList[this.Details.RoomName].SecondPlayer.RemainingPieces.Add(piece);
                }
            }
            void RemovePiece(IPiece piece)
            {
                if (ChessHub.RoomList[this.Details.RoomName].FirstPlayer.Side == this.Details.Side)
                {
                    ChessHub.RoomList[this.Details.RoomName].FirstPlayer.RemainingPieces.Remove(piece);
                }
                else
                {
                    ChessHub.RoomList[this.Details.RoomName].SecondPlayer.RemainingPieces.Remove(piece);
                }
            }
            void RemoveEnemyPiece(IPiece piece)
            {
                if (ChessHub.RoomList[this.Details.RoomName].FirstPlayer.Side == this.Details.Side)
                {
                    ChessHub.RoomList[this.Details.RoomName].SecondPlayer.RemainingPieces.Remove(piece);
                }
                else
                {
                    ChessHub.RoomList[this.Details.RoomName].FirstPlayer.RemainingPieces.Remove(piece);
                }
            }
        }
        public void SetBeatZones()
        {
            int pos = Position;

            var zone1 = pos - 11;
            var zone2 = pos - 9;

            CheckZone(zone1);
            CheckZone(zone2);

            void CheckZone(int zone)
            {
                if (zone >= 0 && zone <= 77 && Board[zone] != null)
                {
                    if (Board[zone].Piece.Value == 'k' && Details.Side != Board[zone].Piece.Details.Side)
                    {
                        Board[pos].IsForDefend = true;                                                                 

                        Details.EnemyKing.IsAttacked++;
                        Details.EnemyKing.UnderAttack = this.Id;                       
                    }
                    else Board[zone].IsAttacked = true;                
                }
            }
        }
        public int IsMovePossible(KingState kingState = KingState.FreeMove)
        {        
            int pos = Position;
            int counter = 0;
            MoveType moveType = MoveType.Move;

            Func<Square, bool> cond;

            if(kingState == KingState.FreeMove)
            {
                cond = (Square s) => { return true; };
            }
            else
            {
                string prop = "";

                if (kingState == KingState.StartDefence) prop = Details.King.UnderAttack;
                else if (kingState == KingState.ContinueDefence) prop = Board[pos].UnderAttack;

                cond = (Square s) =>
                {
                    if (s.IsForDefend == true)
                    {
                        if (moveType == MoveType.Move)
                        {
                            if (prop == s.UnderAttack) return true;
                        }
                        else if (moveType == MoveType.Beat)
                        {
                            if (prop == s.Piece.Id) return true;
                        }
                    }

                    return false;
                };
            }           

            counter += CheckBeatZone(pos - 11, pos - 1, cond);
            counter += CheckBeatZone(pos - 9, pos + 1, cond);
            counter += CheckMoveZone(pos - 10, pos - 20, cond);

            int isMovePossible = (counter > 0) ? 1 : 0;

            return isMovePossible;

            int CheckBeatZone(int zone1, int zone2, Func<Square, bool> condition)
            {
                if (zone1 >= 0 && zone1 <= 77 && Board[zone1] != null)
                {
                    moveType = MoveType.Beat;

                    if (Board[zone1].Piece.Value != ' '
                        && Board[zone1].Piece.Details.Side != this.Details.Side)
                    {
                        if (condition(Board[zone1]))
                        {
                            return 1;
                        }
                    }
                    else if (pos > 29 && pos < 38 && Board[zone2].Piece.Value == 'p'
                             && ((Pawn)Board[zone2].Piece).EnPassant == GetTurnsCount() - 1)//en passant
                    {
                        if (condition(Board[zone2]))
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
                    && Board[zone1].Piece.Value == ' ')
                {
                    moveType = MoveType.Beat;

                    if (condition(Board[zone1]))
                    {
                        return 1;
                    }
                    if (pos > 59 && pos < 68
                        && zone2 >= 0 && zone2 <= 77
                        && Board[zone2] != null
                        && Board[zone2].Piece.Value == ' '
                        && condition(Board[zone2]))
                    {
                        return 1;
                    }
                }
                return 0;
            }
            int GetTurnsCount()
            {
                return ChessHub.RoomList[this.Details.RoomName].TurnsCount;
            }
        }    
        public Pawn(int position, GameDetails details)
        {
            EnPassant = 0;
            Value = 'p';
            Id = Value + (details.PiecesCounter.ToString());

            details.PiecesCounter++;

            Position = position;
            Details = details;
            Board = null;
        }
    }
    public class Rook : IPiece
    {
        public char Value { get; }
        public string Id { get; set; }
        public int Position { get; set; }
        public bool IsFirstTurn { get; set; }
        public GameDetails Details { get; set; }
        public Square[] Board { get; set; }
        protected virtual int[] DirectionIndexes { get; }     
   
        public bool ValidateTurn(TurnInfo turn)
        {                   
            int a = turn.PointA;
            int b = turn.PointB;
            this.Position = b;

            if (KingDefenceCondition() != true) return false;
                      
            int step = 0;           
          
            for (int k = 0; k < (DirectionIndexes.Length / 2); k++)
            {
                if ((a - b) % DirectionIndexes[k] == 0)
                {
                    step = (a > b) ? (-DirectionIndexes[k]) : DirectionIndexes[k];
                    break;
                }
            }

            int currentPos = a + step;
            int finalPos = b + step;
                       
            for (; currentPos != finalPos; currentPos += step)
            {
                if (Board[currentPos].Piece.Value != ' ')
                {
                    if (Board[currentPos].Piece.Details.Side != Details.Side)
                    {
                        currentPos += step;
                        break;
                    }
                    else
                    {
                        return false;
                    }
                }
            }
            if (currentPos == finalPos)//beat figure
            {
                if (Value == 'r' && IsFirstTurn == true) { IsFirstTurn = false; }
                
                Board[b].SetPiece(this);
                Board[a].TakeOffPiece();

                return true;
            }

            return false;

            bool KingDefenceCondition()
            {
                var king = Details.King;
                var pointA = Board[a];
                var pointB = Board[b];

                if (pointB.Piece.Value != 'k' && king.IsAttacked < 2)
                {
                    if (king.IsAttacked > 0)
                    {
                        if (pointA.IsForDefend == true) return false;
                        if (pointB.IsForDefend == true)
                        {
                            if(pointB.Piece.Value == ' ')
                            {
                                if (pointB.UnderAttack != king.UnderAttack) return false;
                            }
                            else
                            {
                                if (pointB.Piece.Id != king.UnderAttack) return false;
                            }
                            
                        }
                    }
                    else if (king.IsPotentiallyAttacked == true)
                    {
                        if (pointA.IsForDefend == true)
                        {
                            if (pointB.IsForDefend == false) return false;
                            else 
                            {
                                if (pointB.Piece.Value == ' ')
                                {
                                    if (pointA.UnderAttack != pointB.UnderAttack) return false;
                                }
                                else
                                {
                                    if (pointA.UnderAttack != pointB.Piece.Id) return false;
                                }
                            }
                            
                        }
                    }
                }
                else return false;

                return true;
            }
        }
        public int IsMovePossible(KingState kingState = KingState.FreeMove)
        {             
            int counter = 0;
            MoveType moveType = MoveType.Move;

            Func<Square, bool> cond;

            if (kingState == KingState.FreeMove)
            {
                cond = (Square s) => { return true; };   
            }
            else
            {
                string prop = "";

                if (kingState == KingState.StartDefence) prop = Details.King.UnderAttack;
                else if (kingState == KingState.ContinueDefence) prop = Board[this.Position].UnderAttack;

                cond = (Square s) =>
                {
                    if (s.IsForDefend == true)
                    {
                        if (moveType == MoveType.Move)
                        {
                            if (prop == s.UnderAttack) return true;
                        }
                        else if (moveType == MoveType.Beat)
                        {
                            if (prop == s.Piece.Id) return true;
                        }
                    }

                    return false;
                };
            }

            int length = DirectionIndexes.Length;
            int i = 0;

            while(counter < 1 && i < length)
            {
                counter += IsZonePossibleToMove(DirectionIndexes[i], cond, ref moveType);
                i++;
            }
            
            return counter;

            int IsZonePossibleToMove(int step, Func<Square, bool> condition, ref MoveType moveType)
            {
                int id = this.Position;
                int i;

                for (i = (id += step); ; i += step)
                {
                    if ((i) >= 0 && (i) <= 77 && Board[i] != null)
                    {
                        if (Board[i].Piece.Value == ' ')
                        {
                            moveType = MoveType.Move;

                            if (condition(Board[i]))
                            {
                                return 1;
                            }
                        }
                        else if (Board[i].Piece.Details.Side != this.Details.Side)
                        {
                            moveType = MoveType.Beat;

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
        }
        public void SetBeatZones()
        {
            int pos = Position;           
            int length = DirectionIndexes.Length;
            int i = 0;

            while (i < length)
            {
                SetZone(DirectionIndexes[i]);
                i++;
            }

            void SetZone(int step)
            {
                int currentPosition = pos + step;
                
                while (PositionInRange(currentPosition))
                {
                    if (SquareIsEmpty(currentPosition))
                    {
                        Board[currentPosition].IsAttacked = true;
                    }
                    else 
                    {
                        if (KingIsOnTheWay(currentPosition)) {
                            Details.EnemyKing.IsAttacked++;
                            Details.EnemyKing.UnderAttack = this.Id;

                            //set all cells from attacking figure to king to isAttacked && isForDefend
                            for (int j = (currentPosition - step); j != pos; j -= step)
                            {
                                Board[j].IsForDefend = true;
                                Board[j].UnderAttack = this.Id;
                            }
                            Board[pos].IsForDefend = true;
                            //set all cells from king to the extreme cell of the board to isAttacked
                            for (int j = (currentPosition + step); PositionInRange(j); j += step)
                            {
                                if (Board[j].Piece.Value == ' ')
                                {
                                    Board[j].IsAttacked = true;
                                }
                                else if (!IsEnemy(j))
                                {
                                    Board[j].IsAttacked = true;
                                    break;
                                }
                            }
                          
                            return;
                        }
                        else
                        {
                            bool isEnemyPiece = false;

                            Board[currentPosition].IsAttacked = true;

                            if (IsEnemy(currentPosition)) 
                            {
                                isEnemyPiece = true;
                            }

                            for (int j = (currentPosition + step); PositionInRange(j); j += step)
                            {
                                if (!SquareIsEmpty(j))
                                {
                                    if (KingIsOnTheWay(j) && isEnemyPiece == true)
                                    {
                                        Details.EnemyKing.IsPotentiallyAttacked = true;

                                        for (int k = j - step; k != pos; k -= step)
                                        {
                                            Board[k].IsForDefend = true;
                                            Board[k].UnderAttack = this.Id;
                                        }
                                        Board[pos].IsForDefend = true;
                                        break;
                                    }
                                    else break;                                  
                                }
                            }

                            return;
                        }
                    }
                   
                    currentPosition += step;
                }
                

                bool PositionInRange(int position)
                {
                    if ((position) >= 0 && (position) <= 77
                         && Board[position] != null) return true;

                    return false;
                }
                bool SquareIsEmpty(int position)
                {
                    return Board[position].Piece.Value == ' ';//empty direction
                }
                bool KingIsOnTheWay(int position)
                {
                    return (Board[position].Piece.Value == 'k' 
                         && IsEnemy(position));
                }
                bool IsEnemy(int position)
                {
                    return (Board[position].Piece.Details.Side != Details.Side);
                }
            }         
        }
      
        public Rook(int position, GameDetails details)
        {
            Value = 'r';
            Id = this.Value + (details.PiecesCounter.ToString());

            details.PiecesCounter++;

            Position = position;
            IsFirstTurn = true;
            Details = details;
            int [] di = { 10, 1, -10, -1 };
            DirectionIndexes = di;
        }
        public Rook(int position, GameDetails details, char value):this(position, details)
        {
            Value = value;
        }     
    }
    public class Bishop : Rook
    {
        protected override int[] DirectionIndexes { get; }   
        public Bishop(int position, GameDetails details) : base(position, details, 'b')
        {
            Id = Value + ((details.PiecesCounter - 1).ToString());
            int[] di = { 11, 9, -11, -9 };     
            DirectionIndexes = di;
        }
    }
    public class Queen : Rook
    {
        protected override int[] DirectionIndexes { get; } 
        public Queen(int position, GameDetails details) : base(position, details, 'q')
        {
            Id = Value + ((details.PiecesCounter - 1).ToString());
            int[] di = { 11, 10, 9, 1, -11, -10, -9, -1 };
            DirectionIndexes = di;
        }
    }
    public class Knight : IPiece
    {
        private int[] MoveIndexes { get; }      
        public char Value { get; }
        public string Id { get; set; }
        public int Position { get; set; }
        public GameDetails Details { get; set; }
        public Square[] Board { get; set; }

        public bool ValidateTurn(TurnInfo turn)
        {
            int a = turn.PointA;
            int b = turn.PointB;
            this.Position = b;

            if (KingDefenceCondition() != true) return false;
   
            foreach (int point in MoveIndexes)
            {
                if (b == a + point)
                {
                    if (Board[b].Piece.Value == ' ' || Board[b].Piece.Details.Side != Details.Side)
                    {
                        Board[b].SetPiece(this);
                        Board[a].TakeOffPiece();

                        return true;
                    }
                    break;
                }
            }

            return false;

            bool KingDefenceCondition()
            {
                var king = Details.King;
                var pointA = Board[a];
                var pointB = Board[b];

                if (pointB.Piece.Value != 'k' && king.IsAttacked < 2)
                {
                    if (king.IsAttacked > 0)
                    {
                        if (pointA.IsForDefend == true) return false;
                        if (pointB.IsForDefend == true)
                        {
                            if (pointB.Piece.Value == ' ')
                            {
                                if (pointB.UnderAttack != king.UnderAttack) return false;
                            }
                            else
                            {
                                if (pointB.Piece.Id != king.UnderAttack) return false;
                            }

                        }
                    }
                    else if (king.IsPotentiallyAttacked == true)
                    {
                        if (pointA.IsForDefend == true)
                        {
                            if (pointB.IsForDefend == false) return false;
                            else
                            {
                                if (pointB.Piece.Value == ' ')
                                {
                                    if (pointA.UnderAttack != pointB.UnderAttack) return false;
                                }
                                else
                                {
                                    if (pointA.UnderAttack != pointB.Piece.Id) return false;
                                }
                            }

                        }
                    }
                }
                else return false;

                return true;
            }
        }
        public void SetBeatZones()
        {
            int pos = Position;
            int nextPos;

            foreach (int point in MoveIndexes)
            {
                nextPos = pos + point;

                if (PositionInRange(nextPos))
                {
                    if (Board[nextPos].Piece.Value == 'k' && this.Details.Side != Board[nextPos].Piece.Details.Side)
                    {
                        Details.EnemyKing.IsAttacked++;
                        Details.EnemyKing.UnderAttack = this.Id;
                        Board[pos].IsForDefend = true;                                                                                     
                    }
                    else
                    {
                        Board[nextPos].IsAttacked = true;
                    }
                }
            }
            bool PositionInRange(int position)
            {
                if ((position) >= 0 && (position) <= 77
                     && Board[position] != null) return true;

                return false;
            }         
        }
        public int IsMovePossible(KingState kingState = KingState.FreeMove)
        {                     
            Func<Square, bool> cond;
            MoveType moveType = MoveType.Move;
            int currentPos; 

            if (kingState == KingState.FreeMove)
            {
                cond = (Square s) => { return true; };
            }
            else
            {
                string prop = "";

                if (kingState == KingState.StartDefence) prop = Details.King.UnderAttack;
                else if (kingState == KingState.ContinueDefence) prop = Board[this.Position].UnderAttack;

                cond = (Square s) =>
                {
                    if (s.IsForDefend == true)
                    {
                        if (moveType == MoveType.Move)
                        {
                            if (prop == s.UnderAttack) return true;
                        }
                        else if (moveType == MoveType.Beat)
                        {
                            if (prop == s.Piece.Id) return true;
                        }
                    }

                    return false;
                };
            }

            foreach (int point in MoveIndexes)
            {
                currentPos = Position + point;

                if (currentPos >= 0 && currentPos <= 77 && Board[currentPos] != null)
                {
                    if (Board[currentPos].Piece.Value == ' ')
                    {
                        moveType = MoveType.Move;

                        if (cond(Board[currentPos]))
                        {
                            return 1;
                        }
                    }
                    else if (Board[currentPos].Piece.Details.Side != Details.Side)
                    {
                        moveType = MoveType.Beat;

                        if (cond(Board[currentPos]))
                        {
                            return 1;
                        }
                    }
                }
            }

            return 0;         
        }

        public Knight(int position, GameDetails details)
        {
            Value = 'n';
            Id = Value + (details.PiecesCounter.ToString());           
            Position = position;
            Details = details;
            int[] mi = { -19, -8, 12, 21, 19, 8, -12, -21 };
            MoveIndexes = mi;

            details.PiecesCounter++;
        }
    }
    public class King : IPiece
    {
        private int[] MoveIndexes { get; } 
        public char Value { get; }
        public string Id { get; set; }
        public int Position { get; set; }
        public bool IsFirstTurn { get; set; }
        public int IsAttacked { get; set; }
        public string UnderAttack { get; set; }
        public bool IsPotentiallyAttacked { get; set; }
        public GameDetails Details { get; set; }
        public Square[] Board { get; set; }

        public bool ValidateTurn(TurnInfo turn)
        {
            var a = turn.PointA;
            var b = turn.PointB;

            if (Board[b] != null && Board[b].Piece.Value == 'k') return false;

            foreach (int point in MoveIndexes)
            {
                if (b == a + point)
                {
                    if (Board[b].IsAttacked == false && (Board[b].Piece.Value == ' ' || Board[b].Piece.Details.Side != Details.Side))
                    {
                        if (IsFirstTurn == true) { IsFirstTurn = false; }
                        
                        Board[b].SetPiece(Board[a].Piece);
                        Board[a].TakeOffPiece();
                        this.Position = b;

                        return true;
                    }
                    break;
                }
            }
            if (Board[b].Piece.Value == 'r' && Board[b].Piece.Details.Side == Details.Side)
            {
                if (this.IsFirstTurn == true
                    && ((Rook)Board[b].Piece).IsFirstTurn == true
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

                    if (Board[p1].Piece.Value == ' '
                        && Board[p2].Piece.Value == ' '
                        && Board[p1].IsAttacked == false
                        && Board[p2].IsAttacked == false
                        && (p3 == b || Board[p3].Piece.Value == ' '))
                    {
                        ((Rook)Board[b].Piece).IsFirstTurn = false;
                        Board[b].Piece.Position = p1;
                        Board[p1].SetPiece(Board[b].Piece);
                        Board[b].TakeOffPiece();

                        this.IsFirstTurn = false;
                        this.Position = p2;
                        Board[p2].SetPiece(Board[a].Piece);
                        Board[a].TakeOffPiece();

                        return true;
                    }
                }
            }

            return false;
        }
        public void SetBeatZones()
        {
            var pos = this.Position;

            foreach (int point in MoveIndexes)
            {
                if ((pos + point) >= 0 && (pos + point) <= 77 && Board[pos + point] != null)
                {
                    Board[pos + point].IsAttacked = true;                 
                }
            }
        }
        public int IsMovePossible(KingState kingState = KingState.FreeMove)
        {
            int currrentPos;

            foreach (int point in MoveIndexes)
            {
                currrentPos = Position + point;

                if (currrentPos >= 0 && currrentPos <= 77
                    && Board[currrentPos] != null
                    && Board[currrentPos].IsAttacked == false)
                {
                    if (Board[currrentPos].Piece.Value == ' '
                        || Board[currrentPos].Piece.Details.Side != Details.Side)
                    {
                        return 1;
                    }
                }
            }

            return 0;
        }

        public King(int position) 
        {
            Value = 'k';
            Position = position;
            IsFirstTurn = true;
            IsAttacked = 0;
            UnderAttack = null;
            IsPotentiallyAttacked = false;        
            Details = null;
            int[] mi = { -11, -10, -9, 1, 11, 10, 9, -1 };
            MoveIndexes = mi;
        }
        public King(int position, GameDetails details) : this(position)
        {
            Id = this.Value + (details.PiecesCounter.ToString());                     
            Details = details;

            details.PiecesCounter++;
        }
    }

    public class EmptyPlacePiece : IPiece
    {
        public char Value { get; set; }
        public string Id { get; set; }
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

        public int IsMovePossible(KingState kingState = KingState.FreeMove)
        {
            throw new NotImplementedException();
        }

        public EmptyPlacePiece()
        {
            Value = ' ';
            Id = " ";
            Position = 0;
            Details = null;
            Board = null;
        }
    }
    public interface IPiece
    {
        char Value { get; }
        string Id { get; set; }
        int Position { get; set; }
        GameDetails Details { get; set; }
        Square[] Board { get; set; }
        bool ValidateTurn(TurnInfo turnInfo);
        void SetBeatZones();
        int IsMovePossible(KingState kingState = KingState.FreeMove);
    }
    public class GameDetails
    {
        public King King { get; set; }
        public King EnemyKing { get; set; }
        public string Side { get; set; }
        public string EnemySide { get; set; }
        public string RoomName { get; set; }
        public int PiecesCounter { get; set; }
    }
    public class CloseSessionRequest
    {
        public string RoomName { get; set; }
        public string Cause { get; set; }
        public string WinnerId { get; set; }
    }
      
    public enum KingState
    {
        StartDefence,
        ContinueDefence,
        FreeMove
    }
    public enum MoveType
    {
        Beat,
        Move
    }
}
