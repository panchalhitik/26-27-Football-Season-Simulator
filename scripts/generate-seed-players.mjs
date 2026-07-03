// Generates src/data/players.json — a hand-curated seed dataset for the 6 clubs
// plus a transfer market pool. Used until the real Kaggle/FIFA pipeline runs.
//
// Run: node scripts/generate-seed-players.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, '..', 'src', 'data', 'players.json');
mkdirSync(dirname(outPath), { recursive: true });

// ---- helpers ---------------------------------------------------------------

const POS_GROUP = {
  GK: 'GK',
  CB: 'DEF', LB: 'DEF', RB: 'DEF',
  CDM: 'MID', CM: 'MID', CAM: 'MID', LM: 'MID', RM: 'MID',
  LW: 'FWD', RW: 'FWD', ST: 'FWD',
};

let nextId = 1;
const players = [];

function add(clubId, pos, name, age, rating, opts = {}) {
  const id = `p-${String(nextId++).padStart(4, '0')}`;
  const group = POS_GROUP[pos];
  // market value model: rough cubic in rating, modulated by age
  const ageFactor = age < 22 ? 1.15 : age < 26 ? 1.05 : age < 29 ? 1.0 : age < 32 ? 0.65 : 0.35;
  const baseValueM = Math.pow(Math.max(rating - 55, 1), 2.2) * 0.18 * ageFactor;
  const marketValueM = Math.round(Math.max(1, baseValueM) * (opts.valueMod ?? 1));
  const wageK = Math.round((rating - 50) * (rating - 50) * 0.18 * (opts.wageMod ?? 1) + 8);
  players.push({
    id,
    name,
    age,
    position: pos,
    group,
    rating,
    potential: opts.potential ?? Math.min(94, rating + (age < 23 ? 6 : age < 26 ? 3 : 1)),
    marketValueM,
    wageK,
    contractYearsLeft: opts.contract ?? (age < 23 ? 4 : age < 30 ? 3 : 2),
    clubId,
    foot: opts.foot ?? 'R',
    nationality: opts.nat ?? 'Unknown',
    isStar: opts.star ?? false,
  });
  return id;
}

// ---- Manchester United (matches the mockup roster) ------------------------

add('manutd', 'GK',  'André Onana',       30, 84, { nat: 'Cameroon' });
add('manutd', 'GK',  'Altay Bayindir',    28, 76, { nat: 'Turkey' });
add('manutd', 'GK',  'Tom Heaton',        40, 68, { nat: 'England' });
add('manutd', 'GK',  'Senne Lammens',     23, 78, { nat: 'Belgium', potential: 86 });
add('manutd', 'RB',  'Diogo Dalot',       27, 82, { nat: 'Portugal' });
add('manutd', 'CB',  'Matthijs de Ligt',  26, 84, { nat: 'Netherlands' });
add('manutd', 'CB',  'Lisandro Martínez', 28, 83, { nat: 'Argentina' });
add('manutd', 'LB',  'Patrick Dorgu',     21, 78, { nat: 'Denmark', potential: 86 });
add('manutd', 'CB',  'Leny Yoro',         20, 82, { nat: 'France', potential: 90 });
add('manutd', 'RB',  'Noussair Mazraoui', 28, 81, { nat: 'Morocco' });
add('manutd', 'CB',  'Harry Maguire',     33, 78, { nat: 'England' });
add('manutd', 'CB',  'Tyrell Malacia',    26, 75, { nat: 'Netherlands' });
add('manutd', 'LB',  'Luke Shaw',         30, 80, { nat: 'England' });
add('manutd', 'CB',  'Ayden Heaven',      19, 73, { nat: 'England', potential: 86 });
add('manutd', 'LB',  'Tyler Fredricson',  21, 70, { nat: 'England', potential: 80 });
add('manutd', 'CB',  'Diego León',        18, 70, { nat: 'Paraguay', potential: 84 });
add('manutd', 'CB',  'Harry Amass',       19, 69, { nat: 'England', potential: 82 });
add('manutd', 'CAM', 'Bruno Fernandes',   31, 86, { nat: 'Portugal' });
add('manutd', 'CAM', 'Matheus Cunha',     27, 83, { nat: 'Brazil' });
add('manutd', 'CDM', 'Manuel Ugarte',     25, 81, { nat: 'Uruguay' });
add('manutd', 'CM',  'Kobbie Mainoo',     21, 81, { nat: 'England', potential: 90 });
add('manutd', 'CDM', 'Mason Mount',       27, 79, { nat: 'England' });
add('manutd', 'CDM', 'Casemiro',          34, 79, { nat: 'Brazil' });
add('manutd', 'CAM', 'Jack Fletcher',     20, 70, { nat: 'England', potential: 82 });
add('manutd', 'CM',  'Tyler Fletcher',    19, 69, { nat: 'England', potential: 81 });
add('manutd', 'CM',  'Toby Collyer',      22, 72, { nat: 'England', potential: 82 });
add('manutd', 'ST',  'Rasmus Højlund',    23, 79, { nat: 'Denmark', potential: 86 });
add('manutd', 'LW',  'Marcus Rashford',   28, 82, { nat: 'England' });
add('manutd', 'RW',  'Amad Diallo',       24, 80, { nat: 'Côte d\'Ivoire', potential: 86 });
add('manutd', 'ST',  'Joshua Zirkzee',    25, 78, { nat: 'Netherlands' });
add('manutd', 'RW',  'Antony',            26, 77, { nat: 'Brazil' });
add('manutd', 'LW',  'Alejandro Garnacho', 22, 80, { nat: 'Argentina', potential: 88 });

// ---- Arsenal ---------------------------------------------------------------
add('arsenal', 'GK',  'David Raya',         30, 84, { nat: 'Spain' });
add('arsenal', 'GK',  'Karl Hein',          24, 72, { nat: 'Estonia', potential: 80 });
add('arsenal', 'GK',  'Tommy Setford',      19, 68, { nat: 'England', potential: 82 });
add('arsenal', 'RB',  'Ben White',          28, 83, { nat: 'England' });
add('arsenal', 'CB',  'William Saliba',     25, 88, { nat: 'France',  star: true });
add('arsenal', 'CB',  'Gabriel Magalhães',  28, 86, { nat: 'Brazil',  star: true });
add('arsenal', 'LB',  'Riccardo Calafiori', 24, 82, { nat: 'Italy',   potential: 87 });
add('arsenal', 'LB',  'Myles Lewis-Skelly', 19, 78, { nat: 'England', potential: 88 });
add('arsenal', 'RB',  'Jurriën Timber',     25, 83, { nat: 'Netherlands' });
add('arsenal', 'CB',  'Cristhian Mosquera', 22, 80, { nat: 'Spain',   potential: 87 });
add('arsenal', 'CDM', 'Declan Rice',        27, 87, { nat: 'England', star: true });
add('arsenal', 'CDM', 'Martín Zubimendi',   27, 84, { nat: 'Spain' });
add('arsenal', 'CM',  'Mikel Merino',       30, 82, { nat: 'Spain' });
add('arsenal', 'CAM', 'Martin Ødegaard',    27, 87, { nat: 'Norway',  star: true });
add('arsenal', 'CM',  'Ethan Nwaneri',      19, 78, { nat: 'England', potential: 90 });
add('arsenal', 'RW',  'Bukayo Saka',        25, 89, { nat: 'England', star: true });
add('arsenal', 'LW',  'Gabriel Martinelli', 25, 83, { nat: 'Brazil' });
add('arsenal', 'ST',  'Viktor Gyökeres',    28, 86, { nat: 'Sweden',  star: true });
add('arsenal', 'ST',  'Kai Havertz',        27, 84, { nat: 'Germany' });
add('arsenal', 'LW',  'Noni Madueke',       24, 80, { nat: 'England' });
add('arsenal', 'LW',  'Leandro Trossard',   31, 80, { nat: 'Belgium' });
add('arsenal', 'ST',  'Gabriel Jesus',      29, 80, { nat: 'Brazil' });
add('arsenal', 'CM',  'Jorginho',           34, 74, { nat: 'Italy' });
add('arsenal', 'CB',  'Jakub Kiwior',       26, 78, { nat: 'Poland' });
add('arsenal', 'CM',  'Albert Sambi Lokonga', 26, 73, { nat: 'Belgium' });
add('arsenal', 'CAM', 'Max Dowman',         16, 67, { nat: 'England', potential: 88 });
add('arsenal', 'RW',  'Reiss Nelson',       26, 73, { nat: 'England' });

// ---- Manchester City -------------------------------------------------------
add('mancity', 'GK',  'Ederson',           32, 85, { nat: 'Brazil' });
add('mancity', 'GK',  'Stefan Ortega',     33, 78, { nat: 'Germany' });
add('mancity', 'GK',  'James Trafford',    23, 75, { nat: 'England', potential: 84 });
add('mancity', 'RB',  'Rico Lewis',        22, 80, { nat: 'England', potential: 88 });
add('mancity', 'CB',  'Rúben Dias',        29, 88, { nat: 'Portugal', star: true });
add('mancity', 'CB',  'Manuel Akanji',     31, 83, { nat: 'Switzerland' });
add('mancity', 'LB',  'Joško Gvardiol',    24, 85, { nat: 'Croatia', star: true });
add('mancity', 'RB',  'Matheus Nunes',     28, 78, { nat: 'Portugal' });
add('mancity', 'CB',  'Nathan Aké',        31, 81, { nat: 'Netherlands' });
add('mancity', 'CB',  'Abdukodir Khusanov', 22, 78, { nat: 'Uzbekistan', potential: 86 });
add('mancity', 'CDM', 'Rodri',             30, 91, { nat: 'Spain', star: true });
add('mancity', 'CM',  'Mateo Kovačić',     32, 82, { nat: 'Croatia' });
add('mancity', 'CM',  'Nico González',     24, 80, { nat: 'Spain' });
add('mancity', 'CM',  'Rayan Aït-Nouri',   25, 81, { nat: 'Algeria' });
add('mancity', 'CAM', 'Phil Foden',        26, 87, { nat: 'England', star: true });
add('mancity', 'CM',  'Bernardo Silva',    32, 86, { nat: 'Portugal' });
add('mancity', 'CDM', 'İlkay Gündoğan',    36, 78, { nat: 'Germany' });
add('mancity', 'RW',  'Savinho',           22, 81, { nat: 'Brazil', potential: 88 });
add('mancity', 'LW',  'Jérémy Doku',       24, 82, { nat: 'Belgium' });
add('mancity', 'RW',  'Oscar Bobb',        23, 78, { nat: 'Norway',  potential: 86 });
add('mancity', 'ST',  'Erling Haaland',    26, 92, { nat: 'Norway',  star: true });
add('mancity', 'ST',  'Omar Marmoush',     27, 82, { nat: 'Egypt' });
add('mancity', 'CAM', 'Claudio Echeverri', 20, 75, { nat: 'Argentina', potential: 87 });

// ---- Liverpool -------------------------------------------------------------
add('liverpool', 'GK',  'Alisson Becker',     33, 88, { nat: 'Brazil', star: true });
add('liverpool', 'GK',  'Giorgi Mamardashvili', 25, 80, { nat: 'Georgia', potential: 87 });
add('liverpool', 'GK',  'Caoimhín Kelleher',  27, 75, { nat: 'Ireland' });
add('liverpool', 'RB',  'Conor Bradley',      23, 79, { nat: 'N. Ireland', potential: 86 });
add('liverpool', 'CB',  'Virgil van Dijk',    34, 87, { nat: 'Netherlands', star: true });
add('liverpool', 'CB',  'Ibrahima Konaté',    27, 83, { nat: 'France' });
add('liverpool', 'LB',  'Andy Robertson',     32, 81, { nat: 'Scotland' });
add('liverpool', 'LB',  'Milos Kerkez',       22, 79, { nat: 'Hungary', potential: 86 });
add('liverpool', 'CB',  'Joe Gomez',          29, 78, { nat: 'England' });
add('liverpool', 'CDM', 'Ryan Gravenberch',   24, 84, { nat: 'Netherlands', potential: 88 });
add('liverpool', 'CM',  'Alexis Mac Allister', 27, 85, { nat: 'Argentina', star: true });
add('liverpool', 'CM',  'Dominik Szoboszlai', 26, 84, { nat: 'Hungary' });
add('liverpool', 'CM',  'Curtis Jones',       25, 80, { nat: 'England' });
add('liverpool', 'CDM', 'Wataru Endo',        33, 76, { nat: 'Japan' });
add('liverpool', 'CAM', 'Florian Wirtz',      23, 88, { nat: 'Germany', star: true });
add('liverpool', 'RW',  'Mohamed Salah',      34, 86, { nat: 'Egypt', star: true });
add('liverpool', 'LW',  'Cody Gakpo',         27, 83, { nat: 'Netherlands' });
add('liverpool', 'LW',  'Luis Díaz',          29, 83, { nat: 'Colombia' });
add('liverpool', 'ST',  'Hugo Ekitiké',       24, 82, { nat: 'France',  potential: 89 });
add('liverpool', 'ST',  'Federico Chiesa',    28, 80, { nat: 'Italy' });
add('liverpool', 'LW',  'Harvey Elliott',     23, 78, { nat: 'England', potential: 86 });

// ---- Real Madrid -----------------------------------------------------------
add('realmadrid', 'GK',  'Thibaut Courtois',  34, 88, { nat: 'Belgium', star: true });
add('realmadrid', 'GK',  'Andriy Lunin',      27, 80, { nat: 'Ukraine' });
add('realmadrid', 'RB',  'Trent Alexander-Arnold', 27, 86, { nat: 'England', star: true });
add('realmadrid', 'CB',  'Antonio Rüdiger',   33, 84, { nat: 'Germany' });
add('realmadrid', 'CB',  'Éder Militão',      28, 85, { nat: 'Brazil' });
add('realmadrid', 'LB',  'Ferland Mendy',     31, 81, { nat: 'France' });
add('realmadrid', 'CB',  'Dean Huijsen',      21, 82, { nat: 'Spain', potential: 89 });
add('realmadrid', 'CB',  'Raúl Asencio',      23, 78, { nat: 'Spain', potential: 85 });
add('realmadrid', 'LB',  'Álvaro Carreras',   23, 80, { nat: 'Spain', potential: 86 });
add('realmadrid', 'CDM', 'Aurélien Tchouaméni', 26, 85, { nat: 'France' });
add('realmadrid', 'CM',  'Eduardo Camavinga', 23, 84, { nat: 'France', potential: 89 });
add('realmadrid', 'CM',  'Federico Valverde', 28, 88, { nat: 'Uruguay', star: true });
add('realmadrid', 'CAM', 'Jude Bellingham',   23, 90, { nat: 'England', star: true });
add('realmadrid', 'CM',  'Arda Güler',        21, 81, { nat: 'Turkey', potential: 89 });
add('realmadrid', 'CDM', 'Dani Ceballos',     30, 77, { nat: 'Spain' });
add('realmadrid', 'RW',  'Rodrygo',           25, 86, { nat: 'Brazil' });
add('realmadrid', 'LW',  'Vinícius Júnior',   26, 91, { nat: 'Brazil', star: true });
add('realmadrid', 'ST',  'Kylian Mbappé',     27, 91, { nat: 'France', star: true });
add('realmadrid', 'LW',  'Endrick',           20, 78, { nat: 'Brazil', potential: 90 });
add('realmadrid', 'RW',  'Brahim Díaz',       27, 81, { nat: 'Morocco' });
add('realmadrid', 'ST',  'Gonzalo García',    22, 75, { nat: 'Spain', potential: 84 });

// ---- Barcelona -------------------------------------------------------------
add('barcelona', 'GK',  'Joan García',       25, 82, { nat: 'Spain', potential: 87 });
add('barcelona', 'GK',  'Wojciech Szczęsny', 36, 79, { nat: 'Poland' });
add('barcelona', 'GK',  'Iñaki Peña',        27, 75, { nat: 'Spain' });
add('barcelona', 'RB',  'Jules Koundé',      27, 85, { nat: 'France' });
add('barcelona', 'CB',  'Pau Cubarsí',       19, 84, { nat: 'Spain', potential: 92 });
add('barcelona', 'CB',  'Ronald Araújo',     27, 85, { nat: 'Uruguay' });
add('barcelona', 'LB',  'Alejandro Balde',   22, 82, { nat: 'Spain', potential: 88 });
add('barcelona', 'CB',  'Andreas Christensen', 30, 79, { nat: 'Denmark' });
add('barcelona', 'CB',  'Eric García',       25, 77, { nat: 'Spain' });
add('barcelona', 'LB',  'Gerard Martín',     24, 76, { nat: 'Spain' });
add('barcelona', 'CDM', 'Marc Casadó',       22, 79, { nat: 'Spain', potential: 86 });
add('barcelona', 'CM',  'Pedri',             23, 88, { nat: 'Spain', star: true });
add('barcelona', 'CM',  'Frenkie de Jong',   29, 84, { nat: 'Netherlands' });
add('barcelona', 'CDM', 'Marc Bernal',       18, 76, { nat: 'Spain', potential: 89 });
add('barcelona', 'CAM', 'Dani Olmo',         28, 84, { nat: 'Spain' });
add('barcelona', 'CM',  'Fermín López',      23, 81, { nat: 'Spain', potential: 87 });
add('barcelona', 'CM',  'Gavi',              22, 82, { nat: 'Spain', potential: 89 });
add('barcelona', 'RW',  'Lamine Yamal',      19, 89, { nat: 'Spain', star: true });
add('barcelona', 'LW',  'Raphinha',          29, 85, { nat: 'Brazil' });
add('barcelona', 'ST',  'Robert Lewandowski', 38, 81, { nat: 'Poland' });
add('barcelona', 'ST',  'Ferran Torres',     26, 80, { nat: 'Spain' });
add('barcelona', 'LW',  'Ansu Fati',         24, 76, { nat: 'Spain' });

// ---- Tottenham Hotspur ----------------------------------------------------
add('spurs', 'GK',  'Guglielmo Vicario',  29, 83, { nat: 'Italy' });
add('spurs', 'GK',  'Antonín Kinský',     22, 75, { nat: 'Czech Rep.', potential: 84 });
add('spurs', 'GK',  'Brandon Austin',     27, 68, { nat: 'England' });
add('spurs', 'RB',  'Pedro Porro',        27, 82, { nat: 'Spain' });
add('spurs', 'RB',  'Djed Spence',        25, 76, { nat: 'England', potential: 82 });
add('spurs', 'CB',  'Cristian Romero',    28, 84, { nat: 'Argentina' });
add('spurs', 'CB',  'Micky van de Ven',   25, 83, { nat: 'Netherlands', potential: 88 });
add('spurs', 'CB',  'Radu Drăgușin',      24, 78, { nat: 'Romania', potential: 84 });
add('spurs', 'CB',  'Kevin Danso',        27, 79, { nat: 'Austria' });
add('spurs', 'CB',  'Ben Davies',         33, 74, { nat: 'Wales' });
add('spurs', 'LB',  'Destiny Udogie',     23, 81, { nat: 'Italy', potential: 87 });
add('spurs', 'CDM', 'Yves Bissouma',      30, 78, { nat: 'Mali' });
add('spurs', 'CM',  'Pape Matar Sarr',    23, 80, { nat: 'Senegal', potential: 86 });
add('spurs', 'CM',  'Rodrigo Bentancur',  29, 80, { nat: 'Uruguay' });
add('spurs', 'CM',  'Archie Gray',        20, 76, { nat: 'England', potential: 87 });
add('spurs', 'CM',  'Lucas Bergvall',     20, 77, { nat: 'Sweden', potential: 86 });
add('spurs', 'CAM', 'James Maddison',     29, 82, { nat: 'England' });
add('spurs', 'CAM', 'Dejan Kulusevski',   26, 82, { nat: 'Sweden' });
add('spurs', 'LM',  'Wilson Odobert',     21, 76, { nat: 'France', potential: 84 });
add('spurs', 'RW',  'Brennan Johnson',    25, 80, { nat: 'Wales' });
add('spurs', 'LW',  'Mohammed Kudus',     26, 82, { nat: 'Ghana' });
add('spurs', 'LW',  'Mikey Moore',        18, 72, { nat: 'England', potential: 86 });
add('spurs', 'LW',  'Mathys Tel',         21, 78, { nat: 'France', potential: 87 });
add('spurs', 'ST',  'Dominic Solanke',    29, 81, { nat: 'England' });
add('spurs', 'ST',  'Richarlison',        29, 78, { nat: 'Brazil' });
add('spurs', 'CB',  'Luka Vušković',      19, 74, { nat: 'Croatia', potential: 86 });
add('spurs', 'RB',  'Archie Williams',    19, 70, { nat: 'England', potential: 82 });
add('spurs', 'CM',  'Will Lankshear',     20, 71, { nat: 'England', potential: 83 });

// ---- Paris Saint-Germain --------------------------------------------------
add('psg', 'GK',  'Lucas Chevalier',      24, 84, { nat: 'France', potential: 88 });
add('psg', 'GK',  'Matvey Safonov',       27, 79, { nat: 'Russia' });
add('psg', 'GK',  'Arnau Tenas',          25, 75, { nat: 'Spain' });
add('psg', 'RB',  'Achraf Hakimi',        27, 87, { nat: 'Morocco', star: true });
add('psg', 'CB',  'Marquinhos',           32, 84, { nat: 'Brazil' });
add('psg', 'CB',  'Willian Pacho',        24, 83, { nat: 'Ecuador', potential: 88 });
add('psg', 'CB',  'Lucas Beraldo',        22, 78, { nat: 'Brazil', potential: 86 });
add('psg', 'CB',  'Presnel Kimpembe',     31, 78, { nat: 'France' });
add('psg', 'LB',  'Nuno Mendes',          24, 85, { nat: 'Portugal', potential: 90, star: true });
add('psg', 'LB',  'Lucas Hernández',      30, 80, { nat: 'France' });
add('psg', 'CDM', 'João Neves',           22, 85, { nat: 'Portugal', potential: 91, star: true });
add('psg', 'CM',  'Vitinha',              26, 86, { nat: 'Portugal', star: true });
add('psg', 'CM',  'Warren Zaïre-Emery',   20, 83, { nat: 'France', potential: 92, star: true });
add('psg', 'CM',  'Fabián Ruiz',          30, 84, { nat: 'Spain' });
add('psg', 'CAM', 'Senny Mayulu',         20, 76, { nat: 'France', potential: 86 });
add('psg', 'CAM', 'Kang-in Lee',          25, 81, { nat: 'South Korea' });
add('psg', 'LW',  'Khvicha Kvaratskhelia',25, 87, { nat: 'Georgia', star: true });
add('psg', 'RW',  'Désiré Doué',          21, 83, { nat: 'France', potential: 91, star: true });
add('psg', 'LW',  'Bradley Barcola',      24, 84, { nat: 'France', potential: 89, star: true });
add('psg', 'RW',  'Ousmane Dembélé',      29, 86, { nat: 'France', star: true });
add('psg', 'ST',  'Gonçalo Ramos',        25, 82, { nat: 'Portugal', potential: 87 });
add('psg', 'ST',  'Randal Kolo Muani',    27, 81, { nat: 'France' });
add('psg', 'CB',  'Yoram Zague',          19, 72, { nat: 'France', potential: 85 });
add('psg', 'CM',  'Quentin Ndjantou',     17, 68, { nat: 'France', potential: 84 });
add('psg', 'LB',  'Ibrahim Mbaye',        18, 71, { nat: 'France', potential: 84 });
add('psg', 'CM',  'Cher Ndour',           21, 76, { nat: 'Italy', potential: 85 });

// ---- Bayern Munich --------------------------------------------------------
add('bayern', 'GK',  'Manuel Neuer',      40, 82, { nat: 'Germany' });
add('bayern', 'GK',  'Jonas Urbig',       22, 75, { nat: 'Germany', potential: 85 });
add('bayern', 'GK',  'Daniel Peretz',     25, 73, { nat: 'Israel' });
add('bayern', 'RB',  'Sacha Boey',        25, 78, { nat: 'France' });
add('bayern', 'RB',  'Konrad Laimer',     29, 80, { nat: 'Austria' });
add('bayern', 'CB',  'Dayot Upamecano',   27, 84, { nat: 'France' });
add('bayern', 'CB',  'Min-jae Kim',       29, 84, { nat: 'South Korea' });
add('bayern', 'CB',  'Jonathan Tah',      30, 84, { nat: 'Germany' });
add('bayern', 'CB',  'Eric Dier',         32, 78, { nat: 'England' });
add('bayern', 'LB',  'Alphonso Davies',   25, 84, { nat: 'Canada', potential: 88 });
add('bayern', 'LB',  'Hiroki Itō',        27, 80, { nat: 'Japan' });
add('bayern', 'CDM', 'Joshua Kimmich',    31, 85, { nat: 'Germany', star: true });
add('bayern', 'CM',  'Aleksandar Pavlović', 22, 82, { nat: 'Germany', potential: 89 });
add('bayern', 'CM',  'Leon Goretzka',     31, 80, { nat: 'Germany' });
add('bayern', 'CM',  'Tom Bischof',       21, 78, { nat: 'Germany', potential: 87 });
add('bayern', 'CAM', 'Jamal Musiala',     23, 89, { nat: 'Germany', star: true });
add('bayern', 'RW',  'Michael Olise',     24, 86, { nat: 'France', potential: 91, star: true });
add('bayern', 'LW',  'Serge Gnabry',      31, 81, { nat: 'Germany' });
add('bayern', 'LW',  'Kingsley Coman',    30, 82, { nat: 'France' });
add('bayern', 'ST',  'Harry Kane',        33, 89, { nat: 'England', star: true });
add('bayern', 'CM',  'Lennart Karl',      18, 72, { nat: 'Germany', potential: 86 });
add('bayern', 'CB',  'Tarek Buchmann',    20, 73, { nat: 'Germany', potential: 84 });
add('bayern', 'ST',  'Mathys Kuhn',       19, 70, { nat: 'Germany', potential: 80 });

// ---- Chelsea --------------------------------------------------------------
add('chelsea', 'GK',  'Robert Sánchez',     28, 79, { nat: 'Spain' });
add('chelsea', 'GK',  'Filip Jörgensen',    23, 76, { nat: 'Denmark', potential: 84 });
add('chelsea', 'GK',  'Mike Penders',       21, 73, { nat: 'Belgium', potential: 83 });
add('chelsea', 'RB',  'Reece James',        26, 84, { nat: 'England', star: true });
add('chelsea', 'RB',  'Malo Gusto',         23, 79, { nat: 'France', potential: 86 });
add('chelsea', 'CB',  'Levi Colwill',       23, 82, { nat: 'England', potential: 89, star: true });
add('chelsea', 'CB',  'Wesley Fofana',      26, 80, { nat: 'France' });
add('chelsea', 'CB',  'Trevoh Chalobah',    27, 79, { nat: 'England' });
add('chelsea', 'CB',  'Tosin Adarabioyo',   29, 78, { nat: 'England' });
add('chelsea', 'LB',  'Marc Cucurella',     28, 82, { nat: 'Spain' });
add('chelsea', 'LB',  'Ben Chilwell',       30, 76, { nat: 'England' });
add('chelsea', 'CDM', 'Moisés Caicedo',     24, 86, { nat: 'Ecuador', star: true });
add('chelsea', 'CM',  'Enzo Fernández',     25, 85, { nat: 'Argentina', star: true });
add('chelsea', 'CM',  'Roméo Lavia',        22, 79, { nat: 'Belgium', potential: 87 });
add('chelsea', 'CAM', 'Cole Palmer',        24, 88, { nat: 'England', star: true });
add('chelsea', 'CAM', 'Christopher Nkunku', 28, 81, { nat: 'France' });
add('chelsea', 'CAM', 'Andrey Santos',      22, 78, { nat: 'Brazil', potential: 87 });
add('chelsea', 'LW',  'Jadon Sancho',       26, 79, { nat: 'England' });
add('chelsea', 'LW',  'Pedro Neto',         26, 82, { nat: 'Portugal' });
add('chelsea', 'RW',  'Noni Madueke II',    24, 80, { nat: 'England' });
add('chelsea', 'RW',  'Geovany Quenda',     19, 76, { nat: 'Portugal', potential: 88 });
add('chelsea', 'ST',  'Nicolas Jackson',    25, 80, { nat: 'Senegal' });
add('chelsea', 'ST',  'João Pedro II',      24, 79, { nat: 'Brazil' });
add('chelsea', 'ST',  'Liam Delap',         23, 78, { nat: 'England', potential: 86 });
add('chelsea', 'ST',  'Marc Guiu',          20, 73, { nat: 'Spain', potential: 84 });
add('chelsea', 'CM',  'Kendry Páez',        19, 74, { nat: 'Ecuador', potential: 87 });
add('chelsea', 'CB',  'Jorrel Hato II',     20, 77, { nat: 'Netherlands', potential: 86 });

// ---- Juventus -------------------------------------------------------------
add('juventus', 'GK',  'Michele Di Gregorio', 28, 81, { nat: 'Italy' });
add('juventus', 'GK',  'Mattia Perin',        33, 76, { nat: 'Italy' });
add('juventus', 'RB',  'Pierre Kalulu',       26, 80, { nat: 'France' });
add('juventus', 'CB',  'Gleison Bremer',      29, 84, { nat: 'Brazil', star: true });
add('juventus', 'CB',  'Federico Gatti',      28, 80, { nat: 'Italy' });
add('juventus', 'CB',  'Lloyd Kelly',         28, 78, { nat: 'England' });
add('juventus', 'CB',  'Daniele Rugani',      32, 75, { nat: 'Italy' });
add('juventus', 'LB',  'Andrea Cambiaso',     26, 82, { nat: 'Italy', potential: 87 });
add('juventus', 'LB',  'Juan Cabal',          25, 78, { nat: 'Colombia', potential: 84 });
add('juventus', 'CDM', 'Manuel Locatelli',    28, 82, { nat: 'Italy' });
add('juventus', 'CM',  'Khéphren Thuram',     25, 82, { nat: 'France', potential: 88 });
add('juventus', 'CM',  'Douglas Luiz',        28, 80, { nat: 'Brazil' });
add('juventus', 'CM',  'Teun Koopmeiners',    28, 81, { nat: 'Netherlands' });
add('juventus', 'CM',  'Hans Nicolussi Caviglia', 26, 76, { nat: 'Italy' });
add('juventus', 'CAM', 'Kenan Yıldız',        21, 81, { nat: 'Turkey', potential: 89, star: true });
add('juventus', 'CAM', 'Nicolò Fagioli',      25, 78, { nat: 'Italy' });
add('juventus', 'LW',  'Francisco Conceição', 23, 80, { nat: 'Portugal', potential: 86 });
add('juventus', 'RW',  'Timothy Weah',        26, 77, { nat: 'USA' });
add('juventus', 'ST',  'Dušan Vlahović',      26, 83, { nat: 'Serbia' });
add('juventus', 'ST',  'Randal Kolo Muani II',27, 80, { nat: 'France' });
add('juventus', 'ST',  'Arkadiusz Milik',     32, 76, { nat: 'Poland' });
add('juventus', 'ST',  'Jonathan David',      26, 82, { nat: 'Canada' });
add('juventus', 'CB',  'Tarik Muharemović',   22, 73, { nat: 'Bosnia', potential: 84 });
add('juventus', 'CM',  'Vasilije Adžić',      20, 73, { nat: 'Montenegro', potential: 84 });

// ---- Inter Milan ----------------------------------------------------------
add('inter', 'GK',  'Yann Sommer',       37, 80, { nat: 'Switzerland' });
add('inter', 'GK',  'Josep Martínez',    28, 78, { nat: 'Spain' });
add('inter', 'RB',  'Denzel Dumfries',   30, 82, { nat: 'Netherlands' });
add('inter', 'RB',  'Matteo Darmian',    36, 76, { nat: 'Italy' });
add('inter', 'CB',  'Alessandro Bastoni', 27, 86, { nat: 'Italy', star: true });
add('inter', 'CB',  'Yann Aurel Bisseck', 26, 80, { nat: 'Germany', potential: 86 });
add('inter', 'CB',  'Francesco Acerbi',  38, 78, { nat: 'Italy' });
add('inter', 'CB',  'Stefan de Vrij',    34, 78, { nat: 'Netherlands' });
add('inter', 'LB',  'Federico Dimarco',  29, 83, { nat: 'Italy' });
add('inter', 'LB',  'Carlos Augusto',    27, 79, { nat: 'Brazil' });
add('inter', 'CDM', 'Hakan Çalhanoğlu',  32, 84, { nat: 'Turkey', star: true });
add('inter', 'CM',  'Nicolò Barella',    29, 86, { nat: 'Italy', star: true });
add('inter', 'CM',  'Henrikh Mkhitaryan', 37, 78, { nat: 'Armenia' });
add('inter', 'CM',  'Davide Frattesi',   27, 81, { nat: 'Italy' });
add('inter', 'CM',  'Piotr Zieliński',   32, 80, { nat: 'Poland' });
add('inter', 'CM',  'Petar Sučić',       22, 77, { nat: 'Croatia', potential: 86 });
add('inter', 'LW',  'Marcus Thuram',     29, 84, { nat: 'France', star: true });
add('inter', 'ST',  'Lautaro Martínez',  29, 86, { nat: 'Argentina', star: true });
add('inter', 'ST',  'Mehdi Taremi',      33, 79, { nat: 'Iran' });
add('inter', 'ST',  'Marko Arnautović',  37, 73, { nat: 'Austria' });
add('inter', 'ST',  'Joaquín Correa',    31, 75, { nat: 'Argentina' });
add('inter', 'CB',  'Tomás Palacios',    22, 76, { nat: 'Argentina', potential: 84 });
add('inter', 'ST',  'Ange-Yoan Bonny',   22, 75, { nat: 'France', potential: 84 });

// ---- Transfer market pool (free agents + sale-listed at other clubs) ------
// These belong to the synthetic 'market' pool — clubId 'market' means
// "buyable, not owned by one of our six target clubs in this seed".

// (Harry Kane → Bayern, Musiala → Bayern, Kvaratskhelia → PSG, Hakimi → PSG, Vitinha → PSG, João Neves → PSG)
// (Cole Palmer → Chelsea, Lautaro Martínez → Inter)
add('market', 'ST',  'Victor Osimhen',      27, 87, { nat: 'Nigeria',     star: true });
add('market', 'CAM', 'Florian Wirtz Jr.',   20, 80, { nat: 'Germany',     potential: 88 });
add('market', 'CB',  'Nico Schlotterbeck',  26, 82, { nat: 'Germany' });
add('market', 'CB',  'Murillo',             23, 82, { nat: 'Brazil',      potential: 88 });
add('market', 'LB',  'Theo Hernández',      29, 84, { nat: 'France' });
add('market', 'RB',  'Denzel Dumfries',     30, 81, { nat: 'Netherlands' });
add('market', 'LW',  'Rafael Leão',         27, 85, { nat: 'Portugal',    star: true });
add('market', 'CM',  'Tijjani Reijnders',   28, 83, { nat: 'Netherlands' });
add('market', 'CAM', 'Xavi Simons',         23, 83, { nat: 'Netherlands', potential: 89 });
add('market', 'CM',  'Enzo Fernández',      25, 84, { nat: 'Argentina' });
add('market', 'CAM', 'Moisés Caicedo',      24, 84, { nat: 'Ecuador' });
add('market', 'LW',  'Nico Williams',       24, 84, { nat: 'Spain',       potential: 89 });
add('market', 'ST',  'Julián Álvarez',      26, 86, { nat: 'Argentina',   star: true });
add('market', 'CAM', 'Roberto De Zerbi Jr.',22, 78, { nat: 'Italy',       potential: 87 });
add('market', 'ST',  'Alexander Isak',      27, 86, { nat: 'Sweden',      star: true });
add('market', 'LW',  'Anthony Gordon',      25, 82, { nat: 'England' });
add('market', 'ST',  'Darwin Núñez',        27, 81, { nat: 'Uruguay' });
add('market', 'CB',  'Goncalo Inácio',      24, 80, { nat: 'Portugal',    potential: 86 });
// (Levi Colwill → Chelsea)
add('market', 'CDM', 'Adam Wharton',        22, 80, { nat: 'England',     potential: 88 });
add('market', 'CAM', 'Morgan Rogers',       24, 80, { nat: 'England',     potential: 86 });
// (Porro → Spurs, Romero → Spurs, Kimmich → Bayern, Tah → Bayern)
add('market', 'CB',  'Antonio Silva',       22, 79, { nat: 'Portugal',    potential: 88 });
add('market', 'GK',  'Mike Maignan',        31, 86, { nat: 'France',      star: true });
add('market', 'GK',  'Diogo Costa',         27, 84, { nat: 'Portugal' });
// (Lucas Chevalier → PSG)
// (Dušan Vlahović → Juventus)
add('market', 'ST',  'Benjamin Šeško',      23, 82, { nat: 'Slovenia',    potential: 89 });
add('market', 'CAM', 'Bruno Guimarães',     28, 84, { nat: 'Brazil' });
add('market', 'CM',  'Eberechi Eze',        28, 82, { nat: 'England' });
// (Michael Olise → Bayern)
// (Bastoni, Barella → Inter)
add('market', 'CB',  'Riccardo Calafiori Jr.', 21, 76, { nat: 'Italy',    potential: 85 });
// (Doué, Zaïre-Emery, Barcola, Kolo Muani, Nuno Mendes, Marquinhos, Pacho → all PSG)
add('market', 'CM',  'Federico Chiesa Jr.', 19, 70, { nat: 'Italy',       potential: 85 });
add('market', 'CB',  'Castello Lukeba',     23, 79, { nat: 'France',      potential: 86 });
// (Khéphren Thuram, Locatelli → Juventus)

// Bulk mid-tier filler for the buy-market list
// Moved to real clubs across the seed: Tel, Maddison, Kulusevski, Bissouma, Pape Matar Sarr,
// Pape Sarr, Dembélé (Spurs/PSG), Cucurella, Fofana (Chelsea).
const fillerNames = [
  'João Pedro', 'Mason Greenwood', 'Yacine Adli', 'Eddie Nketiah', 'Adrien Rabiot',
  'Pierre-Emerick Aubameyang', 'Tammy Abraham', 'Çağlar Söyüncü',
  'Caglar Aksu', 'Castello Lukaku', 'Tariq Lamptey',
  'Ben Brereton', 'Iván Fresneda', 'Conor Gallagher', 'Gianluca Scamacca',
  'Rasmus Kristensen', 'Tijs Velthuis', 'Sergio Reguilón',
  'Sandro Tonali', 'Marc Guéhi', 'Brais Méndez', 'Stanislav Lobotka',
  'Murillo Almeida', 'Issa Kaboré', 'Jorrel Hato', 'Kenneth Taylor', 'Yann Aurel Bisseck',
  'Carlos Augusto', 'Ardon Jashari', 'Ferdi Kadıoğlu',
];
const fillerPositions = ['CB','LB','RB','CDM','CM','CAM','LM','RM','LW','RW','ST'];
let fSeed = 1;
function rand() { fSeed = (fSeed * 9301 + 49297) % 233280; return fSeed / 233280; }
for (const name of fillerNames) {
  const pos = fillerPositions[Math.floor(rand() * fillerPositions.length)];
  const age = 19 + Math.floor(rand() * 13);
  const rating = 71 + Math.floor(rand() * 12);
  add('market', pos, name, age, rating, { nat: 'Various' });
}

writeFileSync(outPath, JSON.stringify(players, null, 2), 'utf8');
console.log(`Wrote ${players.length} players -> ${outPath}`);
