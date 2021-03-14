const sequelize = require('../mixins/sequelize.mixin');
const uuid = require('uuid').v4;
const defaultMixin = require('../mixins/default.mixin');
const tablesName = require('../../config/env.config').models.rules;
const entitiesModel = require('./appointments.definition');
const profileModel = require('./../user-profiles/user_profiles.definition');
const {Op} = require("sequelize");



module.exports = {

    name: 'appointments',

    mixins: [sequelize, defaultMixin],

    settings: [
        {
            name: tablesName.appointments,
            model: entitiesModel.appointments,
            tableName: tablesName.appointments,
        }
    ],

    mixinSetting: {},

    metadata: {},

    dependencies: [],

    actions: {
        create: {
            params: {
                entityUuid: 'string',
                needsFast: 'boolean',
                fastTime: 'string',
                date: 'string',
                $$strict: true
            },
            async handler(ctx){
                try {
                    const {entityUuid, needsFast, fastTime, date} = ctx.params;
                    const appointment = {
                        uuid: uuid(),
                        entityUuid,
                        needsFast,
                        fastTime,
                        date: new Date(date*1000)
                    }

                    const userProfile = await ctx.call('profiles.getById', {entityUuid});

                    const userAge = this.getAge(userProfile.birthDate);

                    if(userAge > 79) {
                        appointment.priority = 3;
                    } else if ((userAge >= 60 && userAge <=79) || userProfile.specialNeeds || userProfile.isPregnant) {
                        appointment.priority = 2;
                    } else {
                        appointment.priority = 1;
                    }

                    appointment.status = 'scheduled';

                    this.cleanCache();

                    return this[tablesName.appointments].create(appointment).then((res) => {
                        return res.dataValues
                    }).catch((err) => {
                        let message = 'Error while trying to create appointment';

                        return Promise.reject(message);
                    });
                } catch (err) {
                    console.log('err= ', err);
                    let message = 'Error while trying to create appointment';
                    if (ctx.meta.$statuscode) {
                        message = err;
                    }
                    return Promise.reject(message);
                }
            }
        },
        createAppointmentSlot: {
            params: {
            },
            async handler(ctx){
                const systemParameters = await ctx.call('systemParameters.get');
                let availableTime = [];
                let i = 0;
                let time = 0;

                let dateStart = new Date();
                let dateEnd = new Date();

                let splitStartDate = systemParameters.activityStartTime.split(':');
                let splitEndDate = systemParameters.activityEndTime.split(':');

                dateStart.setHours(splitStartDate[0], splitStartDate[1]);
                dateEnd.setHours(splitEndDate[0], splitEndDate[1]);

                let totalTime = (dateEnd.getTime() - dateStart.getTime());

                let examTimeMillisecond = systemParameters.examTime * 60000;

                let examNumber = totalTime/examTimeMillisecond;

                while ( i < examNumber ) {
                    time = dateStart.getTime() + (examTimeMillisecond * i);
                    console.log('time =' , time);
                    availableTime[i] = new Date(time);
                    console.log('===> ', `${availableTime[i].getHours()}:${availableTime[i].getMinutes()}` );
                    i++;
                }


            }
        },
        getByUuid: {
            cache: true,
            params: {
                uuid: 'string',
                $$strict: true
            },
            handler(ctx){
                const {uuid} = ctx.params;
                return this[tablesName.appointments].findOne({
                    where: {
                        uuid,
                    },
                    raw: true,
                }).then((res) => {
                    if (res) {
                        return res;
                    } else {
                        ctx.meta.$statuscode = 404;
                        return Promise.reject(new Error('Appointment Not Found'));
                    }
                }).catch((e) => {
                    let message = 'Error while trying to get appointment by uuid';
                    if (ctx.meta.$statuscode) {
                        message = e;
                    }
                    return Promise.reject(message);
                });
            }
        },
        getAll: {
            cache: true,
            handler(ctx){
                return this[tablesName.appointments].findAll({
                    raw: true,
                }).catch((e) => {
                    let message = 'Error while trying to get appointments';
                    if (ctx.meta.$statuscode) {
                        message = e;
                    }
                    return Promise.reject(message);
                });
            }
        },
        getByEntityUuid: {
            params: {
                entityUuid: 'string',
                $$strict: true
            },
            handler(ctx){
                const {entityUuid} = ctx.params;
                return this[tablesName.appointments].findAll({
                    where: {
                        entityUuid
                    },
                    order: [
                      ['date', 'desc']
                    ],
                    raw: true,
                }).catch((e) => {
                    let message = 'Error while trying to get appointments';
                    if (ctx.meta.$statuscode) {
                        message = e;
                    }
                    return Promise.reject(message);
                });
            }
        },
        getLiveLine: {
            handler(ctx){
                console.log(new Date().get);
                return this[tablesName.appointments].findAll({
                    where: {
                        status: 'confirmed',
                        [Op.gte]: ['date', new Date().getTime()]
                    },
                    include: [{
                        model: this.allModels[tablesName.user_profiles]
                    }],
                    order: [
                        ['date', 'asc'],
                        ['priority', 'desc'],
                        ['updatedAt', 'asc']
                    ]
                }).catch((e) => {
                    console.log('e=',e);
                    let message = 'Error while trying to get appointments';
                    if (ctx.meta.$statuscode) {
                        message = e;
                    }
                    return Promise.reject(message);
                });
            }
        },
        update: {
            params: {
                uuid: 'string',
                entityUuid: {type: 'string', optional: true},
                needsFast: {type: 'boolean', optional: true},
                fastTime: {type: 'number', optional: true},
                date: {type: 'string', optional: true},
                priority: {type: 'number', optional: true},
                status: {type: 'string', optional: true},
                $$strict: true
            },
            handler(ctx){
                const {uuid} = ctx.params;
                console.log('Atualizando agendamento com id = ', uuid);
                this.cleanCache();
                delete ctx.params.uuid;
                return this[tablesName.appointments].update(ctx.params, {
                    where: {uuid},
                });
            }
        },
        delete: {
            params: {
                uuid: 'string',
                $$strict: true
            },
            handler(ctx) {
                const {uuid} = ctx.params;
                this.cleanCache();
                return this[tablesName.appointments].destroy({
                    where: {uuid},
                });
            },
        },
    },

    events: {
        'cache.clean.appointments'() {
            if (this.broker.cacher) {
                this.broker.cacher.clean('appointments.**');
            }
        },
    },

    methods: {
        cleanCache() {
            this.broker.broadcast('cache.clean.appointments');
        },
        getAge(userBirthDate) {

            const d = new Date();
            const year = d.getFullYear();
            const month = d.getMonth() + 1;
            const day = d.getDate();
            const birthDate = new Date(userBirthDate);
            const birthYear = birthDate.getFullYear();
            const birthMonth = birthDate.getMonth();
            const birthDay = birthDate.getDate();

            let age = year - birthYear;

            if (month < birthMonth || month === birthMonth && day < birthDay) {
                age--;
            }

            console.log(age < 0 ? 0 : age);
            return age < 0 ? 0 : age;

        }
    },
}
