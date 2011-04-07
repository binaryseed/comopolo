# == Schema Info
#
# Table name: articles
#
#  id             :integer         not null, primary key
#  user_id        :integer
#  title          :string(255)
#  body           :text
#  created_at     :datetime
#  updated_at     :datetime
#  comments_count :integer         not null, default(0)

require 'test_helper'

class ArticleTest < ActiveSupport::TestCase
  
  # def test_get
  # end
  
  def test_to_s
    t = Article.first
    assert_equal t.to_s, t.title
  end
end
