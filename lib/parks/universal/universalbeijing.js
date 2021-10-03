import moment from 'moment-timezone';

import Destination from '../destination.js';
import {attractionType, statusType, queueType, tagType, scheduleType, entityType} from '../parkTypes.js';

export class UniversalBeijing extends Destination {
  constructor(options = {}) {
    options.timezone = options.timezone || 'Asia/Shanghai';

    options.baseURL = options.baseURL || '';

    options.appRelease = options.appRelease || 'r1';
    options.language = options.language || 'en';

    super(options);

    const baseURLHostname = new URL(this.config.baseURL).hostname;
    this.http.injectForDomain({
      hostname: baseURLHostname,
    }, async (method, url, data, options) => {
      if (!options) options = {};
      if (!options.headers) options.headers = {};

      options.headers.language = this.config.language;
      options.headers.release = this.config.appRelease;
    });
  }

  /**
   * Get raw map list data from API
   */
  async getMapData(type = 'attraction') {
    // cache for 2 minutes
    '@cache|2';

    const attractionList = await this.http(
      'GET',
      `${this.config.baseURL}/map/${type}/list`,
      {
        mode: 'map',
      },
    );

    if (attractionList?.body?.msg !== 'OK') {
      throw new Error('Failed to fetch universal beijing attraction list');
    }

    return attractionList?.body?.data?.list;
  }

  async getShowData() {
    '@cache|120';
    return this.getMapData('show');
  }

  /**
   * Helper function to build a basic entity document
   * Useful to avoid copy/pasting
   * @param {object} data 
   * @returns {object}
   */
  buildBaseEntityObject(data) {
    const entity = Destination.prototype.buildBaseEntityObject.call(this, data);

    if (data?.title) {
      entity.name = data.title.replace(/{\d+}/g, '');
    }

    if (data?.position) {
      entity.location = {
        longitude: Number(data.position.longitude),
        latitude: Number(data.position.latitude),
      };
    }

    if (data?.id) {
      entity._id = data.id;
    }

    return entity;
  }

  /**
   * Build the destination entity representing this destination
   */
  async buildDestinationEntity() {
    const doc = {};
    return {
      ...this.buildBaseEntityObject(doc),
      _id: 'universalbeijingresort',
      slug: 'universalbeijingresort',
      name: 'Universal Beijing Resort',
      entityType: entityType.destination,
    };
  }

  /**
   * Build the park entities for this destination
   */
  async buildParkEntities() {
    return [
      {
        ...this.buildBaseEntityObject(null),
        _id: 'universalstudiosbeijing',
        _destinationId: 'universalbeijingresort',
        _parentId: 'universalbeijingresort',
        slug: 'universalstudiosbeijing',
        entityType: entityType.park,
        name: 'Universal Studios Beijing',
      }
    ];
  }

  /**
   * Build the attraction entities for this destination
   */
  async buildAttractionEntities() {
    const attractions = await this.getMapData('attraction');

    return attractions.map(attraction => {
      return {
        ...this.buildBaseEntityObject(attraction),
        entityType: entityType.attraction,
        attractionType: attractionType.ride,
        _destinationId: 'universalbeijingresort',
        _parentId: 'universalstudiosbeijing',
      };
    });
  }

  /**
   * Build the show entities for this destination
   */
  async buildShowEntities() {
    const shows = await this.getShowData();

    return shows.map(show => {
      return {
        ...this.buildBaseEntityObject(show),
        entityType: entityType.show,
        _destinationId: 'universalbeijingresort',
        _parentId: 'universalstudiosbeijing',
      };
    });
  }

  /**
   * Build the restaurant entities for this destination
   */
  async buildRestaurantEntities() {
    return [];
  }

  /**
   * @inheritdoc
   */
  async buildEntityLiveData() {
    const attractions = await this.getMapData('attraction');

    // this function should return all the live data for all entities in this destination
    return attractions.map((x) => {
      const liveData = {
        _id: x.id,
        status: x.gems_status === "2" ? statusType.operating : statusType.closed,
      };

      if (liveData.status === statusType.operating) {
        liveData.queue = {
          [queueType.standBy]: {
            waitTime: x.waiting_time,
          },
        };
      }

      return liveData;
    });
  }

  async _fetchMonthSchedule(month, year) {
    '@cache|720';

    const resp = await this.http(
      'GET',
      `${this.config.baseURL}/event/calendar`,
      {
        date: `${year}-${month < 10 ? '0' + month : month}`,
      },
    );

    return resp?.body?.data?.date_list;
  }

  async _fetchDateSchedule(date) {
    '@cache|720';

    const resp = await this.http(
      'GET',
      `${this.config.baseURL}/event/calendar/${date}`,
    );

    return resp?.body?.data;
  }

  /**
   * Return schedule data for all scheduled entities in this destination
   * Eg. parks
   * @returns {array<object>}
   */
  async buildEntityScheduleData() {
    // get months that cover the next 90 days
    const now = this.getTimeNowMoment();
    const end = now.clone().add(90, 'days');

    const months = [];
    for (let i = now.clone(); i.isSameOrBefore(end, 'month'); i.add(1, 'month')) {
      months.push([i.month() + 1, i.year()]);
    }

    const scheduleData = [];

    for (const month of months) {
      const monthSchedule = await this._fetchMonthSchedule(month[0], month[1]);
      // find dates with valid data
      const dates = monthSchedule.filter((x) => {
        return x.status !== 0 && x.status !== '0';
      }).map((x) => {
        return x.date;
      });

      // fetch valid dates
      for (const date of dates) {
        const dateSchedule = await this._fetchDateSchedule(date);

        if (!dateSchedule?.service_time?.park?.open) {
          continue;
        }

        scheduleData.push({
          date: date,
          type: 'OPERATING',
          openingTime: moment(`${date}T${dateSchedule.service_time.park.open}`, 'YYYY-MM-DDTHH:mm').tz(this.config.timezone, true).format(),
          closingTime: moment(`${date}T${dateSchedule.service_time.park.close}`, 'YYYY-MM-DDTHH:mm').tz(this.config.timezone, true).format(),
        });
      }
    }

    return [
      {
        _id: 'universalstudiosbeijing',
        schedule: scheduleData,
      }
    ];
  }
}

