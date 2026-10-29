import type { Lang } from '../i18n/core';

export interface CatalogAirport {
  iata: string; icao: string; country: string; currency: string; timezone: string; lat: number; lon: number;
  /** Wikipedia article title (English) used to gather related data. */
  wiki: string;
  /** Local labels for the four UI languages. */
  labels: Record<Lang, string>;
  region: 'asia' | 'europe' | 'namerica' | 'mideast' | 'oceania' | 'latam' | 'africa';
}

const a = (iata: string, icao: string, country: string, currency: string, timezone: string, lat: number, lon: number, region: CatalogAirport['region'], wiki: string,
  en: string, zh: string, ko: string, ja: string): CatalogAirport => ({ iata, icao, country, currency, timezone, lat, lon, region, wiki, labels: { en, zh, ko, ja } });

export const AIRPORT_CATALOG: CatalogAirport[] = [
  a('SIN', 'WSSS', 'SG', 'SGD', 'Asia/Singapore', 1.3644, 103.9915, 'asia', 'Singapore Changi Airport', 'Singapore Changi', '新加坡樟宜机场', '싱가포르 창이 공항', 'シンガポール・チャンギ空港'),
  a('HND', 'RJTT', 'JP', 'JPY', 'Asia/Tokyo', 35.5494, 139.7798, 'asia', 'Tokyo International Airport', 'Tokyo Haneda', '东京羽田机场', '도쿄 하네다 공항', '東京国際空港（羽田）'),
  a('NRT', 'RJAA', 'JP', 'JPY', 'Asia/Tokyo', 35.772, 140.3929, 'asia', 'Narita International Airport', 'Tokyo Narita', '东京成田机场', '도쿄 나리타 공항', '成田国際空港'),
  a('KIX', 'RJBB', 'JP', 'JPY', 'Asia/Tokyo', 34.4273, 135.2444, 'asia', 'Kansai International Airport', 'Osaka Kansai', '大阪关西机场', '오사카 간사이 공항', '関西国際空港'),
  a('ICN', 'RKSI', 'KR', 'KRW', 'Asia/Seoul', 37.4602, 126.4407, 'asia', 'Incheon International Airport', 'Seoul Incheon', '首尔仁川机场', '인천국제공항', '仁川国際空港'),
  a('PEK', 'ZBAA', 'CN', 'CNY', 'Asia/Shanghai', 40.0799, 116.6031, 'asia', 'Beijing Capital International Airport', 'Beijing Capital', '北京首都国际机场', '베이징 서우두 국제공항', '北京首都国際空港'),
  a('PVG', 'ZSPD', 'CN', 'CNY', 'Asia/Shanghai', 31.1443, 121.8083, 'asia', 'Shanghai Pudong International Airport', 'Shanghai Pudong', '上海浦东国际机场', '상하이 푸둥 국제공항', '上海浦東国際空港'),
  a('HKG', 'VHHH', 'HK', 'HKD', 'Asia/Hong_Kong', 22.308, 113.9185, 'asia', 'Hong Kong International Airport', 'Hong Kong International', '香港国际机场', '홍콩 국제공항', '香港国際空港'),
  a('TPE', 'RCTP', 'TW', 'TWD', 'Asia/Taipei', 25.0777, 121.2328, 'asia', 'Taiwan Taoyuan International Airport', 'Taipei Taoyuan', '台湾桃园国际机场', '타이완 타오위안 국제공항', '台湾桃園国際空港'),
  a('BKK', 'VTBS', 'TH', 'THB', 'Asia/Bangkok', 13.69, 100.7501, 'asia', 'Suvarnabhumi Airport', 'Bangkok Suvarnabhumi', '曼谷素万那普机场', '방콕 수완나품 공항', 'スワンナプーム国際空港'),
  a('KUL', 'WMKK', 'MY', 'MYR', 'Asia/Kuala_Lumpur', 2.7456, 101.7099, 'asia', 'Kuala Lumpur International Airport', 'Kuala Lumpur International', '吉隆坡国际机场', '쿠알라룸푸르 국제공항', 'クアラルンプール国際空港'),
  a('CGK', 'WIII', 'ID', 'IDR', 'Asia/Jakarta', -6.1256, 106.6559, 'asia', 'Soekarno–Hatta International Airport', 'Jakarta Soekarno-Hatta', '雅加达苏加诺-哈达国际机场', '자카르타 수카르노하타 국제공항', 'スカルノ・ハッタ国際空港'),
  a('DEL', 'VIDP', 'IN', 'INR', 'Asia/Kolkata', 28.5562, 77.1, 'asia', 'Indira Gandhi International Airport', 'Delhi Indira Gandhi', '德里英迪拉·甘地国际机场', '델리 인디라 간디 국제공항', 'インディラ・ガンディー国際空港'),
  a('BOM', 'VABB', 'IN', 'INR', 'Asia/Kolkata', 19.0887, 72.8679, 'asia', 'Chhatrapati Shivaji Maharaj International Airport', 'Mumbai Chhatrapati Shivaji', '孟买贾特拉帕蒂·希瓦吉国际机场', '뭄바이 차트라파티 시바지 국제공항', 'チャトラパティ・シヴァージー国際空港'),
  a('DXB', 'OMDB', 'AE', 'AED', 'Asia/Dubai', 25.2532, 55.3657, 'mideast', 'Dubai International Airport', 'Dubai International', '迪拜国际机场', '두바이 국제공항', 'ドバイ国際空港'),
  a('DOH', 'OTHH', 'QA', 'QAR', 'Asia/Qatar', 25.2731, 51.6081, 'mideast', 'Hamad International Airport', 'Doha Hamad', '多哈哈马德国际机场', '도하 하마드 국제공항', 'ハマド国際空港'),
  a('IST', 'LTFM', 'TR', 'TRY', 'Europe/Istanbul', 41.2753, 28.7519, 'mideast', 'Istanbul Airport', 'Istanbul Airport', '伊斯坦布尔机场', '이스탄불 공항', 'イスタンブール空港'),
  a('LHR', 'EGLL', 'GB', 'GBP', 'Europe/London', 51.47, -0.4543, 'europe', 'Heathrow Airport', 'London Heathrow', '伦敦希思罗机场', '런던 히스로 공항', 'ロンドン・ヒースロー空港'),
  a('CDG', 'LFPG', 'FR', 'EUR', 'Europe/Paris', 49.0097, 2.5479, 'europe', 'Charles de Gaulle Airport', 'Paris Charles de Gaulle', '巴黎戴高乐机场', '파리 샤를 드골 공항', 'パリ＝シャルル・ド・ゴール空港'),
  a('AMS', 'EHAM', 'NL', 'EUR', 'Europe/Amsterdam', 52.3105, 4.7683, 'europe', 'Amsterdam Airport Schiphol', 'Amsterdam Schiphol', '阿姆斯特丹史基浦机场', '암스테르담 스키폴 공항', 'アムステルダム・スキポール空港'),
  a('FRA', 'EDDF', 'DE', 'EUR', 'Europe/Berlin', 50.0379, 8.5622, 'europe', 'Frankfurt Airport', 'Frankfurt Airport', '法兰克福机场', '프랑크푸르트 공항', 'フランクフルト空港'),
  a('MUC', 'EDDM', 'DE', 'EUR', 'Europe/Berlin', 48.3538, 11.7861, 'europe', 'Munich Airport', 'Munich Airport', '慕尼黑机场', '뮌헨 공항', 'ミュンヘン空港'),
  a('MAD', 'LEMD', 'ES', 'EUR', 'Europe/Madrid', 40.4936, -3.5668, 'europe', 'Madrid–Barajas Airport', 'Madrid Barajas', '马德里巴拉哈斯机场', '마드리드 바라하스 공항', 'マドリード・バラハス空港'),
  a('FCO', 'LIRF', 'IT', 'EUR', 'Europe/Rome', 41.8003, 12.2389, 'europe', 'Leonardo da Vinci–Fiumicino Airport', 'Rome Fiumicino', '罗马菲乌米奇诺机场', '로마 피우미치노 공항', 'フィウミチーノ空港'),
  a('ZRH', 'LSZH', 'CH', 'CHF', 'Europe/Zurich', 47.4647, 8.5492, 'europe', 'Zurich Airport', 'Zurich Airport', '苏黎世机场', '취리히 공항', 'チューリッヒ空港'),
  a('JFK', 'KJFK', 'US', 'USD', 'America/New_York', 40.6413, -73.7781, 'namerica', 'John F. Kennedy International Airport', 'New York JFK', '纽约肯尼迪国际机场', '뉴욕 존 F. 케네디 국제공항', 'ジョン・F・ケネディ国際空港'),
  a('LAX', 'KLAX', 'US', 'USD', 'America/Los_Angeles', 33.9416, -118.4085, 'namerica', 'Los Angeles International Airport', 'Los Angeles International', '洛杉矶国际机场', '로스앤젤레스 국제공항', 'ロサンゼルス国際空港'),
  a('ORD', 'KORD', 'US', 'USD', 'America/Chicago', 41.9742, -87.9073, 'namerica', "O'Hare International Airport", "Chicago O'Hare", '芝加哥奥黑尔国际机场', '시카고 오헤어 국제공항', 'シカゴ・オヘア国際空港'),
  a('ATL', 'KATL', 'US', 'USD', 'America/New_York', 33.6407, -84.4277, 'namerica', 'Hartsfield–Jackson Atlanta International Airport', 'Atlanta Hartsfield-Jackson', '亚特兰大哈茨菲尔德-杰克逊国际机场', '애틀랜타 하츠필드-잭슨 국제공항', 'ハーツフィールド・ジャクソン・アトランタ国際空港'),
  a('SFO', 'KSFO', 'US', 'USD', 'America/Los_Angeles', 37.6213, -122.379, 'namerica', 'San Francisco International Airport', 'San Francisco International', '旧金山国际机场', '샌프란시스코 국제공항', 'サンフランシスコ国際空港'),
  a('YYZ', 'CYYZ', 'CA', 'CAD', 'America/Toronto', 43.6777, -79.6248, 'namerica', 'Toronto Pearson International Airport', 'Toronto Pearson', '多伦多皮尔逊国际机场', '토론토 피어슨 국제공항', 'トロント・ピアソン国際空港'),
  a('MEX', 'MMMX', 'MX', 'MXN', 'America/Mexico_City', 19.4363, -99.0721, 'latam', 'Mexico City International Airport', 'Mexico City International', '墨西哥城国际机场', '멕시코시티 국제공항', 'メキシコシティ国際空港'),
  a('GRU', 'SBGR', 'BR', 'BRL', 'America/Sao_Paulo', -23.4356, -46.4731, 'latam', 'São Paulo/Guarulhos International Airport', 'São Paulo Guarulhos', '圣保罗瓜鲁柳斯国际机场', '상파울루 과룰류스 국제공항', 'サンパウロ・グアルーリョス国際空港'),
  a('SYD', 'YSSY', 'AU', 'AUD', 'Australia/Sydney', -33.9399, 151.1753, 'oceania', 'Sydney Airport', 'Sydney Kingsford Smith', '悉尼金斯福德·史密斯机场', '시드니 킹스포드 스미스 공항', 'シドニー空港'),
  a('MEL', 'YMML', 'AU', 'AUD', 'Australia/Melbourne', -37.6733, 144.8433, 'oceania', 'Melbourne Airport', 'Melbourne Airport', '墨尔本机场', '멜버른 공항', 'メルボルン空港'),
  a('AKL', 'NZAA', 'NZ', 'NZD', 'Pacific/Auckland', -37.0082, 174.7917, 'oceania', 'Auckland Airport', 'Auckland Airport', '奥克兰机场', '오클랜드 공항', 'オークランド空港'),
  a('JNB', 'FAOR', 'ZA', 'ZAR', 'Africa/Johannesburg', -26.1337, 28.242, 'africa', 'O. R. Tambo International Airport', 'Johannesburg O. R. Tambo', '约翰内斯堡奥利弗·坦博国际机场', '요하네스버그 O.R. 탐보 국제공항', 'O・R・タンボ国際空港'),
  a('CAI', 'HECA', 'EG', 'EGP', 'Africa/Cairo', 30.1219, 31.4056, 'africa', 'Cairo International Airport', 'Cairo International', '开罗国际机场', '카이로 국제공항', 'カイロ国際空港'),
  a('ADD', 'HAAB', 'ET', 'ETB', 'Africa/Addis_Ababa', 8.9779, 38.7993, 'africa', 'Addis Ababa Bole International Airport', 'Addis Ababa Bole', '亚的斯亚贝巴博莱国际机场', '아디스아바바 볼레 국제공항', 'アディスアベバ・ボレ国際空港'),
];

export const findAirport = (iata: string) => AIRPORT_CATALOG.find((x) => x.iata === iata.toUpperCase());

const COUNTRY_LANG: Record<string, Lang> = { JP: 'ja', KR: 'ko', CN: 'zh', HK: 'zh', TW: 'zh', MO: 'zh' };
/** UI language for an airport's country; English when the app has no matching translation. */
export const langForCountry = (country: string): Lang => COUNTRY_LANG[country.toUpperCase()] ?? 'en';

/** Case-insensitive match across IATA, ICAO and every localized label. */
export function searchCatalog(q: string): CatalogAirport[] {
  const s = q.trim().toLowerCase();
  if (!s) return AIRPORT_CATALOG;
  return AIRPORT_CATALOG.filter((x) => x.iata.toLowerCase().includes(s) || x.icao.toLowerCase().includes(s) || Object.values(x.labels).some((l) => l.toLowerCase().includes(s)));
}
