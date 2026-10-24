-- Sample data for the demo. Teams are the real Liiga clubs; players and results are FICTIONAL.
-- Replace with the Liiga feed (worker/app/liiga.py) when you have access.

insert into public.teams (id, name, short, city, color) values
 ('assat','Ässät','ÄSS','Pori','#C8102E'),
 ('hifk','HIFK','HIFK','Helsinki','#D5001C'),
 ('hpk','HPK','HPK','Hämeenlinna','#F47920'),
 ('ilves','Ilves','ILV','Tampere','#FFC72C'),
 ('jokerit','Jokerit','JOK','Helsinki','#E30613'),
 ('jukurit','Jukurit','JUK','Mikkeli','#00539B'),
 ('jyp','JYP','JYP','Jyväskylä','#C8102E'),
 ('kalpa','KalPa','KAL','Kuopio','#F2C200'),
 ('k-espoo','K-Espoo','KEP','Espoo','#E4002B'),
 ('kookoo','KooKoo','KOO','Kouvola','#F37021'),
 ('karpat','Kärpät','KÄR','Oulu','#FDB913'),
 ('lukko','Lukko','LUK','Rauma','#003DA5'),
 ('pelicans','Pelicans','PEL','Lahti','#5BC2E7'),
 ('saipa','SaiPa','SAI','Lappeenranta','#FFD100'),
 ('sport','Sport','SPO','Vaasa','#C8102E'),
 ('tappara','Tappara','TAP','Tampere','#F26522'),
 ('tps','TPS','TPS','Turku','#000000')
on conflict (id) do nothing;

insert into public.players (id, team_id, name, number, position) values
 ('00000000-0000-0000-0000-000000000101','karpat','Niklas Lindqvist',30,'G'),
 ('00000000-0000-0000-0000-000000000102','karpat','Eetu Saarinen',17,'F'),
 ('00000000-0000-0000-0000-000000000103','karpat','Jesse Virta',22,'F'),
 ('00000000-0000-0000-0000-000000000104','karpat','Aleksi Mäkelä',9,'F'),
 ('00000000-0000-0000-0000-000000000201','tappara','Ville Nurmi',31,'G'),
 ('00000000-0000-0000-0000-000000000202','tappara','Mikko Koskela',4,'D'),
 ('00000000-0000-0000-0000-000000000203','tappara','Otto Heino',27,'F'),
 ('00000000-0000-0000-0000-000000000301','hifk','Tomi Kallio',35,'G'),
 ('00000000-0000-0000-0000-000000000302','hifk','Joonas Laine',12,'F'),
 ('00000000-0000-0000-0000-000000000401','tps','Kalle Vainio',1,'G'),
 ('00000000-0000-0000-0000-000000000402','tps','Lauri Aalto',19,'F'),
 ('00000000-0000-0000-0000-000000000403','tps','Sami Hakala',24,'F'),
 ('00000000-0000-0000-0000-000000000404','tps','Arttu Salo',8,'D'),
 ('00000000-0000-0000-0000-000000000501','ilves','Henri Lampinen',15,'F'),
 ('00000000-0000-0000-0000-000000000502','ilves','Matias Ojala',71,'F'),
 ('00000000-0000-0000-0000-000000000601','lukko','Antti Nieminen',23,'F'),
 ('00000000-0000-0000-0000-000000000602','lukko','Rasmus Berg',44,'F')
on conflict (id) do nothing;

insert into public.games (id, home_id, away_id, starts_at, status, ended_in, home_score, away_score, shots_home, shots_away, venue) values
 ('2026-10-24-karpat-tappara','karpat','tappara','2026-10-24 18:30+03','final','overtime',3,2,29,31,'Raksila, Oulu'),
 ('2026-10-24-hifk-tps','hifk','tps','2026-10-24 18:30+03','final','regulation',1,4,24,30,'Nordis, Helsinki'),
 ('2026-10-24-ilves-lukko','ilves','lukko','2026-10-24 19:00+03','live',null,2,2,22,25,'Nokia Arena, Tampere'),
 ('2026-10-27-karpat-kalpa','karpat','kalpa','2026-10-27 18:30+02','scheduled',null,0,0,null,null,'Raksila, Oulu')
on conflict (id) do nothing;

insert into public.game_events (game_id, period, clock, game_seconds, type, team_id, player_id, detail, score_after) values
 ('2026-10-24-karpat-tappara',1,'08:14', 494,'goal','karpat','00000000-0000-0000-0000-000000000102',null,'1–0'),
 ('2026-10-24-karpat-tappara',1,'17:31',1051,'save','karpat','00000000-0000-0000-0000-000000000101','Glove save on a breakaway',null),
 ('2026-10-24-karpat-tappara',2,'04:06',1446,'goal','tappara','00000000-0000-0000-0000-000000000202',null,'1–1'),
 ('2026-10-24-karpat-tappara',2,'11:02',1862,'fight',null,null,'Scrum after the whistle',null),
 ('2026-10-24-karpat-tappara',2,'18:54',2334,'goal','tappara','00000000-0000-0000-0000-000000000203','PP','1–2'),
 ('2026-10-24-karpat-tappara',3,'12:18',3138,'goal','karpat','00000000-0000-0000-0000-000000000103',null,'2–2'),
 ('2026-10-24-karpat-tappara',3,'18:42',3522,'save','karpat','00000000-0000-0000-0000-000000000101','Pad save at 6-on-5',null),
 ('2026-10-24-karpat-tappara',4,'03:41',3821,'goal','karpat','00000000-0000-0000-0000-000000000104','OT winner','3–2'),
 ('2026-10-24-hifk-tps',2,'02:24',1344,'goal','tps','00000000-0000-0000-0000-000000000402',null,'0–1'),
 ('2026-10-24-hifk-tps',2,'09:54',1794,'goal','tps','00000000-0000-0000-0000-000000000403',null,'0–2'),
 ('2026-10-24-hifk-tps',2,'18:12',2292,'goal','tps','00000000-0000-0000-0000-000000000402',null,'0–3'),
 ('2026-10-24-hifk-tps',3,'11:00',3060,'goal','tps','00000000-0000-0000-0000-000000000404',null,'0–4'),
 ('2026-10-24-hifk-tps',3,'17:36',3456,'goal','hifk','00000000-0000-0000-0000-000000000302','PP','1–4'),
 ('2026-10-24-ilves-lukko',1,'06:40', 400,'goal','ilves','00000000-0000-0000-0000-000000000501',null,'1–0'),
 ('2026-10-24-ilves-lukko',2,'13:05',1985,'goal','lukko','00000000-0000-0000-0000-000000000601',null,'1–1'),
 ('2026-10-24-ilves-lukko',3,'02:11',2531,'goal','ilves','00000000-0000-0000-0000-000000000502',null,'2–1'),
 ('2026-10-24-ilves-lukko',3,'07:15',2835,'goal','lukko','00000000-0000-0000-0000-000000000602','PP','2–2');

-- A few readers so the newsroom can show "who gets which variant".
insert into public.reader_profiles (device_id, language, team_ids, style, formats) values
 ('demo-1','fi','{karpat}','quick','{summary,podcast}'),
 ('demo-2','fi','{karpat,tappara}','full','{summary}'),
 ('demo-3','en','{karpat}','fan','{summary,highlight}'),
 ('demo-4','sv','{hifk,tps}','quick','{summary}'),
 ('demo-5','fi','{tappara}','quick','{summary,podcast}'),
 ('demo-6','en','{tps}','full','{summary,highlight}')
on conflict (device_id) do nothing;
