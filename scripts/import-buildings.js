
import shapefile from 'shapefile';
import proj4 from 'proj4';
import pool from '../backend/utils/database.js';

// --- Configuration ---
const SHAPEFILE_PATH = 'backend/data/서울특별시_금천구/11545/TL_SPBD_BULD.shp';
const BATCH_SIZE = 200; // 한 번에 데이터베이스에 삽입할 레코드 수

// --- Coordinate System Definitions ---
// Source: UTM-K (Bessel) - EPSG:5178 or similar custom definitions are often used.
// This definition is for GRS80/UTM-K, which matches the PRJ file.
proj4.defs('UTMK', '+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +units=m +no_defs');

// Target: WGS84 (Latitude/Longitude) - EPSG:4326
proj4.defs('WGS84', '+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs');

// --- Main Function ---
async function importBuildings() {
  console.log('🏢 건물 데이터 임포트를 시작합니다...');
  const client = await pool.connect();
  let totalImportedCount = 0;
  let totalUpsertedCount = 0;

  try {
    const source = await shapefile.open(SHAPEFILE_PATH);
    let featuresBatch = [];
    let feature;

    console.log('📂 Shapefile을 읽는 중...');
    while (!(feature = await source.read()).done) {
      featuresBatch.push(feature.value);

      if (featuresBatch.length >= BATCH_SIZE) {
        const { imported, upserted } = await processBatch(featuresBatch, client);
        totalImportedCount += imported;
        totalUpsertedCount += upserted;
        featuresBatch = [];
        process.stdout.write(`... 처리된 건물 수: ${totalImportedCount}\r`);
      }
    }

    // Process any remaining features
    if (featuresBatch.length > 0) {
      const { imported, upserted } = await processBatch(featuresBatch, client);
      totalImportedCount += imported;
      totalUpsertedCount += upserted;
    }

    console.log(`\n\n✨ 총 ${totalImportedCount}개의 건물을 성공적으로 처리했습니다.`);
    console.log(`   - ${totalUpsertedCount}개는 기존 데이터를 업데이트했습니다.`);
    console.log(`   - ${totalImportedCount - totalUpsertedCount}개는 새로 추가되었습니다.`);

  } catch (error) {
    console.error('\n💥 임포트 중 오류가 발생했습니다:', error.message);
  } finally {
    client.release();
    await pool.end();
    console.log('🔚 데이터베이스 연결이 종료되었습니다.');
  }
}

async function processBatch(features, client) {
  const values = [];
  for (const feature of features) {
    if (!feature.geometry) continue;

    // 1. Transform coordinates
    const transformedGeometry = transformGeometry(feature.geometry);
    if (!transformedGeometry) continue;

    // 2. Prepare data for insertion
    const props = feature.properties;
    values.push([
      props.BD_MGT_SN, // bd_mgt_sn
      props.SIG_CD,    // sig_cd
      `${props.LNBR_MNNM}-${props.LNBR_SLNO}`, // lotno_addr
      null, // road_nm_addr (can be populated later)
      props.BULD_NM ? props.BULD_NM.replace(/\0/g, '') : null, // bldg_nm (clean null chars)
      props.GRO_FLO_CO, // ground_floor_count
      props.UND_FLO_CO, // underground_floor_count
      props.BDTYP_CD,  // building_type_code
      JSON.stringify(transformedGeometry) // geometry
    ]);
  }

  if (values.length === 0) {
    return { imported: 0, upserted: 0 };
  }

  // 3. Construct and run the UPSERT query
  const query = `
    INSERT INTO kor.bldg (
      bd_mgt_sn, sig_cd, lotno_addr, road_nm_addr, bldg_nm, 
      gro_flo_co, und_flo_co, bdtyp_cd, bldg_geom
    )
    SELECT 
      v.bd_mgt_sn, v.sig_cd, v.lotno_addr, v.road_nm_addr, v.bldg_nm, 
      v.gro_flo_co, v.und_flo_co, v.bdtyp_cd, ST_SetSRID(ST_GeomFromGeoJSON(v.bldg_geom), 4326)
    FROM (
      SELECT
        unnest($1::varchar[]) as bd_mgt_sn, unnest($2::varchar[]) as sig_cd,
        unnest($3::varchar[]) as lotno_addr, unnest($4::varchar[]) as road_nm_addr,
        unnest($5::varchar[]) as bldg_nm, unnest($6::integer[]) as gro_flo_co,
        unnest($7::integer[]) as und_flo_co, unnest($8::varchar[]) as bdtyp_cd,
        unnest($9::jsonb[]) as bldg_geom
    ) AS v
    ON CONFLICT (bd_mgt_sn) DO UPDATE SET
      sig_cd = EXCLUDED.sig_cd,
      lotno_addr = EXCLUDED.lotno_addr,
      bldg_nm = EXCLUDED.bldg_nm,
      gro_flo_co = EXCLUDED.gro_flo_co,
      und_flo_co = EXCLUDED.und_flo_co,
      bdtyp_cd = EXCLUDED.bdtyp_cd,
      bldg_geom = EXCLUDED.bldg_geom,
      updated_at = NOW();
  `;

  // Transpose the values array for the query
  const queryParams = values[0].map((_, colIndex) => values.map(row => row[colIndex]));
  
  const result = await client.query(query, queryParams);
  return { imported: values.length, upserted: result.rowCount }; // Approximation, good enough for logging
}

function transformGeometry(geometry) {
  if (!geometry || !geometry.coordinates) return null;

  const newCoords = geometry.coordinates.map(ring =>
    ring.map(point => {
      // Sometimes rings are nested one level deeper (for MultiPolygons)
      if (Array.isArray(point[0])) {
        return point.map(p => proj4('UTMK', 'WGS84', p));
      }
      return proj4('UTMK', 'WGS84', point);
    })
  );

  return { ...geometry, coordinates: newCoords };
}


// --- Execute Script ---
importBuildings();
