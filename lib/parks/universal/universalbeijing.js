
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
   * Get raw attraction list data from API
   */
  async getAttractionList() {
    // cache for 4 hours
    '@cache|240';

    const attractionList = await this.http(
      'GET',
      `${this.config.baseURL}/map/attraction/list`,
      {
        mode: 'map',
      },
    );

    if (attractionList?.body?.msg !== 'OK') {
      throw new Error('Failed to fetch universal beijing attraction list');
    }

    return attractionList?.body?.data?.list;
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
    const attractions = await this.getAttractionList();

    return attractions.map(attraction => {
      return {
        ...this.buildBaseEntityObject(attraction),
        entityType: entityType.attraction,
        _destinationId: 'universalbeijingresort',
        _parentId: 'universalstudiosbeijing',
      };
    });
  }

  /**
   * Build the show entities for this destination
   */
  async buildShowEntities() {
    return [];
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
    // this function should return all the live data for all entities in this destination
    return [
      {
        // use the same _id as our entity objects use
        _id: 'internalId',
        status: statusType.operating,
        queue: {
          [queueType.standBy]: {
            waitTime: 10,
          }
        },
      },
    ];
  }

  /**
   * Return schedule data for all scheduled entities in this destination
   * Eg. parks
   * @returns {array<object>}
   */
  async buildEntityScheduleData() {
    return [
      {
        _id: 'internalId',
        schedule: [
          {
            "date": "2021-05-31",
            "type": "OPERATING",
            "closingTime": "2021-05-31T19:30:00+08:00",
            "openingTime": "2021-05-31T10:30:00+08:00",
          },
        ],
      }
    ];
  }
}

