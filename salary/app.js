const express = require('express')
const async = require('async')

const cors = require('cors')

const app = express()
app.use(cors())

app.get('/salary', (req, res) => { 
    res.redirect("https://api.dbknews.com/#tag-salary")
})

app.get('/salary/year/:year', async (req, res) => { 
    let query = buildQuery(req)
    let countQuery = buildQuery(req, "count")
    
    let results = await runQuery(res, query.string, query.params)
    let count = await runQuery(res, countQuery.string, countQuery.params)
    
    sendResponse(res, 200, { data: results, count: count[0]["COUNT(*)"] })
})

/**
 * Takes in a request object and builds a SQL query for the Salary Guide database.
 * 
 * @param {object} req - Express request variable.
 * @param {string} type - Define what kind of query to build (results or count)
 * 
 */
let buildQuery = (req, type="results") => {
    let PAGESIZE = 10
    let COLUMNS = ['Division', "Department", "Title", "Employee", "Salary"]
    let year = req.params.year
    if (!year){
        sendResponse(500, "Invalid year parameter supplied.")
    }
    let page = req.query.page
    let offset = 0
    if (page && !isNaN(page) && page >= 1){
        offset = (page-1) * PAGESIZE
    }

    let queryString = `SELECT * FROM ??`
    if (type === "count") {
        queryString = `SELECT COUNT(*) FROM ??`
    }

    let queryParams = [year+"Data"]

    let search = req.query.search
    if (search) {
        queryString += ` WHERE `
        COLUMNS.forEach((col, i) => {
            queryString += ` ${col} LIKE ? ${i < COLUMNS.length-1 ? 'OR' : ''} `
            queryParams.push('%'+search+'%')
        })
    }

    if (type === "count") {
        return {
            string: queryString,
            params: queryParams
        }
    }

    let sortby = req.query.sortby
    if (sortby) {
        if (sortby.toLowerCase() === 'salary'){ //For sorting salaries, we need to parse the salary value into a number
            queryString += "ORDER BY CAST(REPLACE(REPLACE(salary,'$',''),',','') AS UNSIGNED) "
        }
        else{
            queryString += ` ORDER BY REPLACE(??,' ','') ` //ignore whitespace while sorting
            queryParams.push(sortby)
        }        
    }

    //By default, SQL orders by ASC. If the user specifies DESC, order by that instead.
    if (req.query.order && req.query.order.toUpperCase() === 'DESC'){
        queryString += ' DESC '
    }

    queryString += ` LIMIT ${offset}, ${PAGESIZE} `
    queryString = queryString.trim()
    queryString = queryString.replace(/ +/g, " ")

    return {
        string: queryString,
        params: queryParams
    }
}

/**
 * Runs a SQL query and returns the result, otherwise sends an error.
 * 
 * @param {object} res - Express response variable.
 * @param {string} query - Query string to pass into SQL.
 * @param {array} params - Objects to substitute into the query.
 */
let runQuery = async function (res, query, params) {
    let db = require('../utilities/db')

    try {
        let results = await db.query(query, params)
        return results
    }
    catch (err) {
        handleError(res, err)
    }
}


/**
 * Sends a response using Express. 
 * 
 * @param {object} res - Express response variable.
 * @param {int} status - Status code to return.
 * @param {string} message - Message to return with code.
 */
let sendResponse = (res, status, message) => {
    res.status(status).send(message)
}

/**
 * Parses the failed response object from SQL into a meaningful error response.
 * 
 * @param {object} res - Express response variable
 * @param {object} error - Error object from SQL execution.
 */
let handleError = (res, error) => {
    if (error.code === 'ER_NO_SUCH_TABLE') {
        sendResponse(res, 500, {message: 'Invalid Year Supplied'})
    }
    else {
        sendResponse(res, 500, error)
    }
}

module.exports = app