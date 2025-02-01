<div className="hr-line-box" key={repo._id}>
<div className="repo-name-link">
  <div className="repo-main-info">
    <div
      className="profile-repo-name-underline"
      onClick={() => navigate(`/${repo.name}`)}
    >
      <p
        style={{
          color: "#74b9ff",
          display: "flex",
          fontWeight: "500",
          fontSize: "18px",
          margin: "0",
        }}
      >
        {repo.name}
      </p>
    </div>
    <p className="profile-repo-desc">
      {repo.description &&
      repo.description.length > 50
        ? repo.description.substring(0, 100) + "..."
        : repo.description}
    </p>
  </div>
</div>
</div>